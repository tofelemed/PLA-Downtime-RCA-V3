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
  failure_mode: string | null;
  description: string | null;
}

type MatchRow = { kb_id: string } & Record<`m_${KnowledgeMatch}`, boolean>;

/** RCA-08: the same failure mode weighs most, then the asset, the reason, shared words and the unit. */
const WEIGHTS: Readonly<Record<KnowledgeMatch, number>> = {
  failure_mode: 4,
  asset: 3,
  reason: 2,
  text: 1,
  unit: 1,
};
const KEYS = Object.keys(WEIGHTS) as KnowledgeMatch[];
const MAX_WORDS = 12;

/** Words of the event's failure mode and description as an OR text query (`simple` config, no stemming). */
export function textQuery(...texts: Array<string | null>): string | null {
  const words = texts
    .join(' ')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 3);
  const unique = [...new Set(words)].slice(0, MAX_WORDS);
  return unique.length ? unique.join(' | ') : null;
}

const NORMALIZED_MODE = (column: string) =>
  `lower(btrim(regexp_replace(${column}, '\\s+', ' ', 'g')))`;
const ENTRY_TEXT = `to_tsvector('simple', concat_ws(' ', ${KB_ALIAS}."title", ${KB_ALIAS}."root_cause",
  ${KB_ALIAS}."problem_statement", ${KB_ALIAS}."description", ${KB_ALIAS}."failure_mode"))`;

/** Match expressions for an event; a fact the event does not have never matches. */
function matchExpressions(
  event: EventFacts,
  query: string | null,
): Record<KnowledgeMatch, string> {
  return {
    failure_mode: event.failure_mode?.trim()
      ? `(${NORMALIZED_MODE(`${KB_ALIAS}."failure_mode"`)} = ${NORMALIZED_MODE(':failureMode')}
          OR ${LINKED_EVENT(`${NORMALIZED_MODE('e."failure_mode"')} = ${NORMALIZED_MODE(':failureMode')}`)})`
      : 'false',
    asset: event.asset_id
      ? `(${KB_ALIAS}."asset_id" = :assetId OR ${LINKED_EVENT('e."asset_id"::text = :assetId')})`
      : 'false',
    reason: event.reason_code_id
      ? LINKED_EVENT('e."reason_code_id" = :reasonCodeId')
      : 'false',
    text: query ? `${ENTRY_TEXT} @@ to_tsquery('simple', :textQuery)` : 'false',
    unit: `${KB_ALIAS}."unit_id" = :unitId`,
  };
}

const matchesOf = (row: MatchRow): KnowledgeMatch[] =>
  KEYS.filter((key) => row[`m_${key}`]);

/**
 * "Similar past RCAs" of an event (owner decision 2026-10-12, RCA-08): knowledge entries of the caller's
 * scope that share the event's failure mode (entry or a linked event of its case), asset, reason code,
 * words of its failure mode / description, or unit. Ranked on the server by relevance (failure mode 4 +
 * asset 3 + reason 2 + text 1 + unit 1), then published first, then newest; the event's own case is
 * left out.
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
      `SELECT "unit_id"::text AS "unit_id", "asset_id"::text AS "asset_id", "reason_code_id"::text AS "reason_code_id",
              "failure_mode", "description"
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
    const query = textQuery(event.failure_mode, event.description);
    const match = matchExpressions(event, query);
    const relevance = KEYS.map(
      (key) => `(CASE WHEN ${match[key]} THEN ${WEIGHTS[key]} ELSE 0 END)`,
    ).join(' + ');
    const qb = scopedEntries(this.dataSource.manager, context).select(
      `${KB_ALIAS}.id`,
      'kb_id',
    );
    for (const key of KEYS) qb.addSelect(match[key], `m_${key}`);
    return qb
      .andWhere(`(${KEYS.map((key) => match[key]).join(' OR ')})`)
      .andWhere(`NOT ${LINKED_EVENT('e."id" = :eventId')}`)
      .setParameters({
        assetId: event.asset_id,
        reasonCodeId: event.reason_code_id,
        unitId: event.unit_id,
        eventId: input.eventId,
        failureMode: event.failure_mode ?? '',
        textQuery: query ?? '',
      })
      .orderBy(`(${relevance})`, 'DESC')
      .addOrderBy(`${KB_ALIAS}.is_published`, 'DESC')
      .addOrderBy(`${KB_ALIAS}.created_at`, 'DESC')
      .addOrderBy(`${KB_ALIAS}.id`, 'DESC')
      .limit(input.limit)
      .getRawMany<MatchRow>();
  }
}
