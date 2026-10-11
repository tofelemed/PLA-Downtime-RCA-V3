import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { restrictedUnitIds } from '../common/query/scoped-query';
import { notFound } from '../rca-case/rca-scope';
import {
  KB_ALIAS,
  LINKED_EVENT,
  RcaKnowledgeV2Service,
  scopedEntries,
} from './knowledge-v2.service';
import { KnowledgeMatch, RcaKnowledgeSimilarV2View } from './knowledge-v2.view';

interface EventFacts {
  unit_id: string;
  asset_id: string | null;
  reason_code_id: string | null;
}

interface MatchRow {
  kb_id: string;
  m_asset: boolean;
  m_reason: boolean;
  m_unit: boolean;
}

const WEIGHTS: Readonly<Record<KnowledgeMatch, number>> = {
  asset: 3,
  reason: 2,
  unit: 1,
};

/** Match expressions for an event; a fact the event does not have never matches. */
function matchExpressions(event: EventFacts): Record<KnowledgeMatch, string> {
  return {
    asset: event.asset_id
      ? `(${KB_ALIAS}."asset_id" = :assetId OR ${LINKED_EVENT('e."asset_id"::text = :assetId')})`
      : 'false',
    reason: event.reason_code_id
      ? LINKED_EVENT('e."reason_code_id" = :reasonCodeId')
      : 'false',
    unit: `${KB_ALIAS}."unit_id" = :unitId`,
  };
}

function matchesOf(row: MatchRow): KnowledgeMatch[] {
  const flags: Record<KnowledgeMatch, boolean> = {
    asset: row.m_asset,
    reason: row.m_reason,
    unit: row.m_unit,
  };
  return (Object.keys(WEIGHTS) as KnowledgeMatch[]).filter((key) => flags[key]);
}

/**
 * "Similar past RCAs" of an event (owner decision 2026-10-12): knowledge entries of the caller's scope
 * that share the event's asset (entry asset or an event linked to the source case), reason code (of an
 * event linked to the source case) or unit. Ranked on the server by relevance (asset 3 + reason 2 +
 * unit 1), then published first, then newest; entries whose case is already linked to this event are
 * left out (they are the event's own case, not a past one).
 */
@Injectable()
export class RcaKnowledgeSimilarService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly entries: RcaKnowledgeV2Service,
  ) {}

  async similar(
    context: RequestContext,
    input: { eventId: string; limit: number },
  ): Promise<RcaKnowledgeSimilarV2View[]> {
    const event = await this.eventFacts(context, input.eventId);
    const rows = await this.rankedMatches(context, event, input);
    if (rows.length === 0) return [];
    const manager = this.dataSource.manager;
    const ids = rows.map((row) => row.kb_id);
    const found = await scopedEntries(manager, context)
      .andWhere(`${KB_ALIAS}.id IN (:...ids)`, { ids })
      .getMany();
    const byId = new Map(found.map((entry) => [entry.id, entry]));
    const ordered = rows.flatMap((row) => {
      const entry = byId.get(row.kb_id);
      return entry ? [{ row, entry }] : [];
    });
    const views = await this.entries.views(
      manager,
      context,
      ordered.map((item) => item.entry),
    );
    return views.map((view, index) => {
      const matchedOn = matchesOf(ordered[index].row);
      const relevance = matchedOn.reduce((sum, key) => sum + WEIGHTS[key], 0);
      return { ...view, matchedOn, relevance };
    });
  }

  /** The event of the caller's tenant and units (404 otherwise: no existence leak). */
  private async eventFacts(
    context: RequestContext,
    eventId: string,
  ): Promise<EventFacts> {
    const tenantId = requireTenantId(context);
    const rows: EventFacts[] = await this.dataSource.query(
      `SELECT "unit_id"::text AS "unit_id", "asset_id"::text AS "asset_id", "reason_code_id"::text AS "reason_code_id"
         FROM "production_events" WHERE "id" = $1 AND "tenant_id" = $2`,
      [eventId, tenantId],
    );
    const units = restrictedUnitIds(context, tenantId);
    const event = rows[0];
    if (!event || (units && !units.includes(event.unit_id))) {
      throw notFound('Production event');
    }
    return event;
  }

  private rankedMatches(
    context: RequestContext,
    event: EventFacts,
    input: { eventId: string; limit: number },
  ): Promise<MatchRow[]> {
    const match = matchExpressions(event);
    const relevance = (Object.keys(WEIGHTS) as KnowledgeMatch[])
      .map((key) => `(CASE WHEN ${match[key]} THEN ${WEIGHTS[key]} ELSE 0 END)`)
      .join(' + ');
    return scopedEntries(this.dataSource.manager, context)
      .select(`${KB_ALIAS}.id`, 'kb_id')
      .addSelect(match.asset, 'm_asset')
      .addSelect(match.reason, 'm_reason')
      .addSelect(match.unit, 'm_unit')
      .andWhere(`(${match.asset} OR ${match.reason} OR ${match.unit})`)
      .andWhere(`NOT ${LINKED_EVENT('e."id" = :eventId')}`)
      .setParameters({
        assetId: event.asset_id,
        reasonCodeId: event.reason_code_id,
        unitId: event.unit_id,
        eventId: input.eventId,
      })
      .orderBy(`(${relevance})`, 'DESC')
      .addOrderBy(`${KB_ALIAS}.is_published`, 'DESC')
      .addOrderBy(`${KB_ALIAS}.created_at`, 'DESC')
      .addOrderBy(`${KB_ALIAS}.id`, 'DESC')
      .limit(input.limit)
      .getRawMany<MatchRow>();
  }
}
