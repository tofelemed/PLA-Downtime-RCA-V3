import { ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RequestContext } from '../common/context/request-context';
import { RcaTriggerEvaluation } from '../rca/entities/rca-trigger-evaluation.entity';
import { keysetPage } from '../v2/common/keyset-page';
import { listResponse, ListResponse } from '../v2/common/response';
import { RcaRecommendationV2ListQueryDto } from '../v2/rca/rca-links-v2.dto';
import {
  recommendationEventFacts,
  RcaRecommendationEventFacts,
} from './recommendation-event-facts';
import { notFound, scopeOf } from './rca-scope';

/** A trigger firing as the UI shows it: a recommendation badge with its attribution. */
export interface RcaRecommendationV2View {
  id: string;
  eventId: string;
  occurrenceId: string | null;
  unitId: string;
  trigger: string;
  source: { kind: string; id: string; version: number };
  firedOn: string;
  provisional: boolean;
  outcome: string;
  state: string;
  rcaId: string | null;
  detail: Record<string, unknown>;
  firedAt: string;
  confirmedAt: string | null;
  resolvedAt: string | null;
  /** F-1: facts of the event (null when the event is not readable any more) */
  event: RcaRecommendationEventFacts | null;
}

const toView = (
  row: RcaTriggerEvaluation,
  event: RcaRecommendationEventFacts | null,
): RcaRecommendationV2View => ({
  id: row.id,
  eventId: row.eventId,
  occurrenceId: row.occurrenceId,
  unitId: row.unitId,
  trigger: row.trigger,
  source: {
    kind: row.sourceKind,
    id: row.sourceId,
    version: row.sourceVersion,
  },
  firedOn: row.firedOn,
  provisional: row.provisional,
  outcome: row.outcome,
  state: row.state,
  rcaId: row.rcaId,
  detail: row.detail,
  firedAt: row.firedAt.toISOString(),
  confirmedAt: row.confirmedAt ? row.confirmedAt.toISOString() : null,
  resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
  event,
});

/**
 * Recommendations recorded by the trigger service (`RCARecommended`): listed for badges, accepted by
 * linking or creating a case, or dismissed by a person with a reason. Never acted on automatically.
 */
@Injectable()
export class RcaRecommendationsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async list(
    context: RequestContext,
    query: RcaRecommendationV2ListQueryDto,
  ): Promise<ListResponse<RcaRecommendationV2View>> {
    const scope = scopeOf(context);
    const qb = this.dataSource
      .getRepository(RcaTriggerEvaluation)
      .createQueryBuilder('t')
      .where('t.tenantId = :tenantId AND t.state = :state', {
        tenantId: scope.tenantId,
        state: query.state ?? 'open',
      });
    if (scope.units)
      qb.andWhere('t.unitId = ANY(:units::uuid[])', { units: scope.units });
    if (query.unitId)
      qb.andWhere('t.unitId = :unitId', { unitId: query.unitId });
    if (query.eventIds?.length)
      qb.andWhere('t.eventId = ANY(:eventIds::uuid[])', {
        eventIds: query.eventIds,
      });
    const page = await keysetPage(qb, {
      alias: 't',
      property: 'firedAt',
      direction: 'DESC',
      cursor: query.cursor,
      limit: query.limit,
    });
    const facts = await recommendationEventFacts(
      this.dataSource.manager,
      scope.tenantId,
      page.items.map((row) => row.eventId),
    );
    const items = page.items.map((row) =>
      toView(row, facts.get(row.eventId) ?? null),
    );
    return listResponse(items, page.nextCursor, {
      tenantId: scope.tenantId,
      ...(scope.units ? { unitIds: scope.units } : {}),
    });
  }

  async dismiss(
    context: RequestContext,
    id: string,
    reason: string,
  ): Promise<RcaRecommendationV2View> {
    const scope = scopeOf(context);
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(RcaTriggerEvaluation);
      const row = await repository
        .createQueryBuilder('t')
        .setLock('pessimistic_write')
        .where('t.id = :id AND t.tenantId = :tenantId', {
          id,
          tenantId: scope.tenantId,
        })
        .getOne();
      if (!row || (scope.units && !scope.units.includes(row.unitId)))
        throw notFound('Recommendation');
      if (row.state !== 'open') {
        throw new ConflictException({
          code: 'INVALID_TRANSITION',
          message: `an ${row.state} recommendation cannot be dismissed`,
        });
      }
      Object.assign(row, {
        state: 'dismissed',
        resolvedBy: scope.userId,
        resolvedAt: new Date(),
        detail: { ...row.detail, dismissReason: reason },
      });
      const saved = await repository.save(row);
      const facts = await recommendationEventFacts(manager, scope.tenantId, [
        saved.eventId,
      ]);
      return toView(saved, facts.get(saved.eventId) ?? null);
    });
  }
}
