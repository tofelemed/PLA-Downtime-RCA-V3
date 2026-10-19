import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import {
  scheduledIntervals,
  StateCoverage,
  stateCoverage,
} from '../../domain/reliability/state-coverage';
import { StateSegment } from '../../domain/reliability/unit-state';
import { OPEN_ENDED } from '../../periods/period-recalc';
import { assertBodyUnitsInScope } from '../../periods/period-scope';
import { UnitStateMapping } from '../../reliability/entities/unit-state-mapping.entity';
import { loadStateTimeline } from '../../reliability/unit-state/state-timeline.loader';
import { CursorCodec, invalidCursor } from '../common/cursor-codec';
import { invalidField } from '../master-data/common/master-data-errors';
import { ANALOG_SIGNAL_TYPES, thresholdsOf } from './analog-thresholds-input';
import { requestReliabilityRecalc } from './reliability-recalc';
import { windowOf } from './reliability-v2-common';
import {
  UnitStateCoverageQueryDto,
  UnitStateMappingCreateDto,
  UnitStateMappingListQueryDto,
} from './unit-state-v2.dto';

const MAX_WINDOW_MS = 31 * 86_400_000;
const MAX_SEGMENTS = 5000;

export interface UnitStateCoverageV2View {
  unitId: string;
  from: string;
  to: string;
  /** null = the unit has no state mapping in the window (no state engine for it yet) */
  coverage: StateCoverage | null;
  /**
   * set when the window starts before the unit's first state mapping: coverage and segments start at this
   * instant (the first version's effective start, QA M3); null = they cover the whole window
   */
  coverageStartsAt: string | null;
  segments: Array<{
    start: string;
    end: string;
    state: string;
    unknownReason: string | null;
  }>;
  /** more segments than returned (the coverage still counts them all) */
  truncated: boolean;
}

/**
 * Unit state mappings (SME D1 / D2): versions of a unit's signal → state mapping and heartbeat, and the
 * state timeline with known-data coverage and availability bounds over a window (scheduled time = the
 * window minus excluded shifts). Gaps are never filled; unknown time stays in the denominator.
 */
@Injectable()
export class UnitStateV2Service {
  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  async list(context: RequestContext, query: UnitStateMappingListQueryDto) {
    assertBodyUnitsInScope(context, [query.unitId], 'unitId');
    const qb = scopedQuery(this.manager.getRepository(UnitStateMapping), 'm', {
      context,
      unitProperty: 'unitId',
    }).andWhere('m.unitId = :unitId', { unitId: query.unitId });
    if (query.cursor) {
      const { sortValue, id } = CursorCodec.decode(query.cursor);
      if (typeof sortValue !== 'number') throw invalidCursor();
      qb.andWhere('(m.version < :v OR (m.version = :v AND m.id < :id))', {
        v: sortValue,
        id,
      });
    }
    const rows = await qb
      .orderBy('m.version', 'DESC')
      .addOrderBy('m.id', 'DESC')
      .take(query.limit + 1)
      .getMany();
    const items = rows.slice(0, query.limit);
    const last = items[items.length - 1];
    const nextCursor =
      rows.length > query.limit && last
        ? CursorCodec.encode({ sortValue: last.version, id: last.id })
        : null;
    return { items, nextCursor };
  }

  async create(
    context: RequestContext,
    input: UnitStateMappingCreateDto,
  ): Promise<UnitStateMapping> {
    const tenantId = requireTenantId(context);
    assertBodyUnitsInScope(context, [input.unitId], 'unitId');
    const thresholds = thresholdsOf(input.thresholds);
    if (input.rules.length === 0 && !thresholds)
      throw invalidField('rules', 'a mapping needs rules or analog thresholds');
    await this.assertSignal(tenantId, input, thresholds !== null);
    const from = input.effectiveFrom
      ? new Date(input.effectiveFrom)
      : new Date();
    return this.manager.transaction(async (manager) => {
      await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `unit_state_mappings:${tenantId}:${input.unitId}`,
      ]);
      const open = await manager
        .getRepository(UnitStateMapping)
        .createQueryBuilder('m')
        .where(
          'm.tenantId = :tenantId AND m.unitId = :unitId AND m.effectiveTo IS NULL',
          { tenantId, unitId: input.unitId },
        )
        .getOne();
      if (open && from <= open.effectiveFrom) {
        throw invalidField(
          'effectiveFrom',
          'effectiveFrom must be after the start of the mapping in force',
        );
      }
      const [{ next }] = await manager.query<Array<{ next: number }>>(
        `SELECT coalesce(max("version"), 0) + 1 AS "next" FROM "unit_state_mappings" WHERE "tenant_id" = $1 AND "unit_id" = $2`,
        [tenantId, input.unitId],
      );
      await manager.query(
        `UPDATE "unit_state_mappings" SET "effective_to" = $3 WHERE "tenant_id" = $1 AND "unit_id" = $2 AND "effective_to" IS NULL`,
        [tenantId, input.unitId, from],
      );
      const saved = await manager.save(
        manager.create(UnitStateMapping, {
          ...rowOf(tenantId, context.userId, input, { from, version: next }),
          thresholds,
        }),
      );
      // the state timeline of the unit changes from the new version on (coverage KPIs, SME D1 / D2)
      await requestReliabilityRecalc(
        manager,
        context,
        [{ unitId: input.unitId, start: from, end: OPEN_ENDED }],
        'unit_state_mapping_changed',
      );
      return saved;
    });
  }

  async coverage(
    context: RequestContext,
    query: UnitStateCoverageQueryDto,
  ): Promise<UnitStateCoverageV2View> {
    const tenantId = requireTenantId(context);
    assertBodyUnitsInScope(context, [query.unitId], 'unitId');
    const window = windowOf(query.from, query.to);
    if (window.end.getTime() - window.start.getTime() > MAX_WINDOW_MS) {
      throw new UnprocessableEntityException({
        code: 'INVALID_RANGE',
        message: 'The window is at most 31 days',
      });
    }
    await this.assertUnit(tenantId, query.unitId);
    const scope = { tenantId, unitId: query.unitId };
    const { timeline, covered } = await this.timelineOf(scope, window);
    const excluded = await this.excludedShifts(scope, covered);
    const segments = timeline ?? [];
    return {
      unitId: query.unitId,
      from: window.start.toISOString(),
      to: window.end.toISOString(),
      coverage: timeline
        ? stateCoverage(timeline, scheduledIntervals(covered, excluded, false))
        : null,
      coverageStartsAt:
        timeline && covered.start > window.start
          ? covered.start.toISOString()
          : null,
      segments: segments.slice(0, MAX_SEGMENTS).map(segmentView),
      truncated: segments.length > MAX_SEGMENTS,
    };
  }

  /**
   * The state timeline over the window; when no mapping is in force at its start, over the part from the
   * unit's first mapping version on (QA M3: the time before it has no state engine, not "unknown").
   */
  private async timelineOf(
    scope: { tenantId: string; unitId: string },
    window: { start: Date; end: Date },
  ) {
    const timeline = await loadStateTimeline(this.manager, scope, window);
    if (timeline) return { timeline, covered: window };
    const rows = await this.manager.query<Array<{ first: Date | null }>>(
      `SELECT min("effective_from") AS "first" FROM "unit_state_mappings"
        WHERE "tenant_id" = $1 AND "unit_id" = $2 AND "effective_from" > $3 AND "effective_from" < $4`,
      [scope.tenantId, scope.unitId, window.start, window.end],
    );
    const first = rows[0]?.first ? new Date(rows[0].first) : null;
    if (!first) return { timeline: null, covered: window };
    const covered = { start: first, end: window.end };
    return {
      timeline: await loadStateTimeline(this.manager, scope, covered),
      covered,
    };
  }

  private async excludedShifts(
    scope: { tenantId: string; unitId: string },
    window: { start: Date; end: Date },
  ) {
    const rows = await this.manager.query<
      Array<{ utc_start: Date; utc_end: Date }>
    >(
      `SELECT "utc_start", "utc_end" FROM "shift_instances"
        WHERE "tenant_id" = $1 AND "unit_id" = $2 AND "is_excluded" AND "utc_start" < $4 AND "utc_end" > $3`,
      [scope.tenantId, scope.unitId, window.start, window.end],
    );
    return rows.map((r) => ({
      start: new Date(r.utc_start),
      end: new Date(r.utc_end),
    }));
  }

  private async assertUnit(tenantId: string, unitId: string): Promise<void> {
    const rows = await this.manager.query<unknown[]>(
      `SELECT 1 FROM "units" WHERE "id" = $1 AND "tenant_id" = $2`,
      [unitId, tenantId],
    );
    if (rows.length === 0)
      throw invalidField('unitId', 'unitId must be a unit of this plant');
  }

  /** 422 unless the signal is a state signal of that unit and plant. */
  private async assertSignal(
    tenantId: string,
    input: UnitStateMappingCreateDto,
    analog: boolean,
  ): Promise<void> {
    const rows = await this.manager.query<Array<{ semantic_type: string }>>(
      `SELECT "semantic_type" FROM "signals" WHERE "id" = $1 AND "tenant_id" = $2 AND "unit_id" = $3`,
      [input.signalId, tenantId, input.unitId],
    );
    if (rows.length === 0)
      throw invalidField('signalId', 'signalId must be a signal of this unit');
    const type = rows[0].semantic_type;
    if (analog ? !ANALOG_SIGNAL_TYPES.has(type) : type !== 'state')
      throw invalidField(
        'signalId',
        analog
          ? 'signalId must be a state, rate, level or other signal'
          : 'signalId must be a state signal',
      );
  }
}

function rowOf(
  tenantId: string,
  actorId: string | null,
  input: UnitStateMappingCreateDto,
  version: { from: Date; version: number },
): Partial<UnitStateMapping> {
  return {
    tenantId,
    unitId: input.unitId,
    signalId: input.signalId,
    rules: input.rules.map((r) => ({ match: r.match.trim(), state: r.state })),
    expectedIntervalSeconds: input.expectedIntervalSeconds,
    jitterSeconds: input.jitterSeconds ?? 0,
    staleAfterIntervals: input.staleAfterIntervals ?? 3,
    isHeartbeat: input.isHeartbeat ?? true,
    version: version.version,
    notes: input.notes?.trim() || null,
    effectiveFrom: version.from,
    effectiveTo: null,
    createdBy: actorId,
    updatedBy: actorId,
  };
}

const segmentView = (s: StateSegment) => ({
  start: s.start.toISOString(),
  end: s.end.toISOString(),
  state: s.state,
  unknownReason: s.unknownReason,
});
