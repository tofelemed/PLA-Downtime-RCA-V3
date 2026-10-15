import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { standbyMetrics } from '../../domain/reliability/standby-metrics';
import { StandbyEquipment } from '../../reliability/entities/standby-equipment.entity';
import { StandbyRecord } from '../../reliability/entities/standby-record.entity';
import { keysetPage } from '../common/keyset-page';
import { invalidField } from '../master-data/common/master-data-errors';
import {
  assetsOf,
  assertUnitsWritable,
  windowOf,
} from './reliability-v2-common';
import {
  StandbyEquipmentCreateDto,
  StandbyListQueryDto,
  StandbyMetricsQueryDto,
} from './standby-v2.dto';
import { StandbyMetricsV2View } from './standby-v2.view';
import { OPEN_ENDED } from '../../periods/period-recalc';
import { requestReliabilityRecalc } from './reliability-recalc';

/** A standby duty starting or ending changes the MTBF exposure of its asset from then on (SME D9). */
const dutyChanged = (
  manager: EntityManager,
  context: RequestContext,
  change: { unitId: string; from: Date },
) =>
  requestReliabilityRecalc(
    manager,
    context,
    [{ unitId: change.unitId, start: change.from, end: OPEN_ENDED }],
    'standby_duty_changed',
  );

const notFound = () =>
  new NotFoundException({
    code: 'NOT_FOUND',
    message: 'The standby registration was not found',
  });

/**
 * Standby equipment (SME D9): which assets are evaluated as standby and how, and their measures over a
 * window — failure on demand, test failures, operating MTBF on the asset's own running time (exposure and
 * zero failures shown, never an infinite MTBF) and the standby time apart from it.
 */
@Injectable()
export class StandbyEquipmentV2Service {
  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  list(context: RequestContext, query: StandbyListQueryDto) {
    const qb = scopedQuery(this.manager.getRepository(StandbyEquipment), 's', {
      context,
      unitProperty: 'unitId',
    });
    if (query.assetIds?.length)
      qb.andWhere('s.assetId IN (:...assetIds)', { assetIds: query.assetIds });
    return keysetPage(qb, {
      alias: 's',
      property: 'effectiveFrom',
      direction: 'ASC',
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  async register(
    context: RequestContext,
    input: StandbyEquipmentCreateDto,
  ): Promise<StandbyEquipment> {
    const tenantId = requireTenantId(context);
    const [asset] = await assetsOf(this.manager, tenantId, {
      ids: [input.assetId],
      codes: [],
    });
    if (!asset)
      throw invalidField('assetId', 'assetId must be an asset of this plant');
    assertUnitsWritable(context, [asset.unitId]);
    const current = await this.manager.query<unknown[]>(
      `SELECT 1 FROM "standby_equipment" WHERE "tenant_id" = $1 AND "asset_id" = $2 AND "effective_to" IS NULL`,
      [tenantId, asset.id],
    );
    if (current.length > 0) {
      throw new ConflictException({
        code: 'STANDBY_ALREADY_REGISTERED',
        message: 'The asset is already registered as standby',
      });
    }
    const from = input.effectiveFrom
      ? new Date(input.effectiveFrom)
      : new Date();
    return this.manager.transaction(async (manager) => {
      const saved = await manager.save(
        manager.create(StandbyEquipment, {
          tenantId,
          assetId: asset.id,
          unitId: asset.unitId,
          evaluation: input.evaluation,
          notes: input.notes?.trim() || null,
          effectiveFrom: from,
          effectiveTo: null,
          createdBy: context.userId,
          updatedBy: context.userId,
        }),
      );
      await dutyChanged(manager, context, { unitId: asset.unitId, from });
      return saved;
    });
  }

  async retire(
    context: RequestContext,
    id: string,
    effectiveTo: string | undefined,
  ): Promise<StandbyEquipment> {
    const row = await scopedQuery(
      this.manager.getRepository(StandbyEquipment),
      's',
      { context, unitProperty: 'unitId' },
    )
      .andWhere('s.id = :id', { id })
      .getOne();
    if (!row) throw notFound();
    if (row.effectiveTo)
      throw new ConflictException({
        code: 'STANDBY_ENDED',
        message: 'The standby duty has ended already',
      });
    const end = effectiveTo ? new Date(effectiveTo) : new Date();
    if (end <= row.effectiveFrom)
      throw invalidField(
        'effectiveTo',
        'effectiveTo must be after the start of the duty',
      );
    await this.manager.transaction(async (manager) => {
      await manager.update(StandbyEquipment, row.id, {
        effectiveTo: end,
        updatedBy: context.userId,
      });
      await dutyChanged(manager, context, { unitId: row.unitId, from: end });
    });
    return { ...row, effectiveTo: end };
  }

  /** Measures of every registered asset overlapping the window (bounded by the plant's standby fleet). */
  async metrics(
    context: RequestContext,
    query: StandbyMetricsQueryDto,
  ): Promise<StandbyMetricsV2View[]> {
    const window = windowOf(query.from, query.to);
    const registrations = await this.registrationsIn(
      context,
      window,
      query.assetIds,
    );
    const assetIds = [...new Set(registrations.map((r) => r.assetId))];
    if (assetIds.length === 0) return [];
    const records = await this.manager
      .getRepository(StandbyRecord)
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId AND r.assetId IN (:...assetIds)', {
        tenantId: requireTenantId(context),
        assetIds,
      })
      .andWhere(
        'r.startedAt < :to AND (r.endedAt IS NULL OR r.endedAt >= :from)',
        { from: window.start, to: window.end },
      )
      .getMany();
    const asOf = new Date(Math.min(Date.now(), window.end.getTime()));
    return assetIds.map((assetId) => {
      const own = registrations.filter((r) => r.assetId === assetId);
      const log = records
        .filter((r) => r.assetId === assetId)
        .map((r) => ({
          kind: r.recordKind,
          start: r.startedAt,
          end: r.endedAt,
          outcome: r.outcome,
        }));
      const registered = own.map((r) => ({
        start: r.effectiveFrom,
        end: r.effectiveTo ?? asOf,
      }));
      const latest = own[own.length - 1];
      return {
        assetId,
        unitId: latest.unitId,
        evaluation: latest.evaluation,
        ...standbyMetrics(log, window, { asOf, registered }),
      };
    });
  }

  private registrationsIn(
    context: RequestContext,
    window: { start: Date; end: Date },
    assetIds: readonly string[] | undefined,
  ): Promise<StandbyEquipment[]> {
    const qb = scopedQuery(this.manager.getRepository(StandbyEquipment), 's', {
      context,
      unitProperty: 'unitId',
    })
      .andWhere(
        's.effectiveFrom < :to AND (s.effectiveTo IS NULL OR s.effectiveTo > :from)',
        { from: window.start, to: window.end },
      )
      .orderBy('s.assetId')
      .addOrderBy('s.effectiveFrom')
      .take(500);
    if (assetIds?.length)
      qb.andWhere('s.assetId IN (:...assetIds)', { assetIds });
    return qb.getMany();
  }
}
