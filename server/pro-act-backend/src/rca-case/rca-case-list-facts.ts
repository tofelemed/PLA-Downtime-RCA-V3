import { EntityManager } from 'typeorm';
import { actionOverdueSql } from './action-overdue';
import { RcaScope } from './rca-scope';

/** The case's first linked event (by link time): the trigger the list shows. */
export interface RcaCaseTriggerRef {
  eventId: string;
  startTime: string;
  unitId: string;
}

/** Action progress of a case: cancelled actions are left out of `total`; overdue as in the summary. */
export interface RcaCaseActionCounts {
  total: number;
  done: number;
  overdue: number;
}

export interface RcaCaseListFacts {
  trigger: RcaCaseTriggerRef | null;
  actions: RcaCaseActionCounts;
}

interface FactsRow {
  rca_id: string;
  event_id: string | null;
  start_time: Date | string | null;
  unit_id: string | null;
  total: number;
  done: number;
  overdue: number;
}

/**
 * One query for a whole list page (no request per case): per case, the first linked event of the
 * caller's units (`rca_case_links` by `(linked_at, id)`, joined to `production_events` by primary key)
 * and the action counts, each a LATERAL subquery over the case's own index (`IDX_rca_case_links_tenant_rca`,
 * `IDX_rca_actions_tenant_rca`).
 */
export const CASE_LIST_FACTS_SQL = `SELECT r."id" AS "rca_id", t."event_id", t."start_time", t."unit_id",
       COALESCE(c."total", 0)::int AS "total", COALESCE(c."done", 0)::int AS "done", COALESCE(c."overdue", 0)::int AS "overdue"
  FROM unnest($2::uuid[]) AS r("id")
  LEFT JOIN LATERAL (
    SELECT e."id" AS "event_id", e."start_time", e."unit_id"
      FROM "rca_case_links" k
      JOIN "production_events" e
        ON e."id" = CASE WHEN k."link_type" = 'event' THEN k."target_id"::uuid END AND e."tenant_id" = k."tenant_id"
     WHERE k."tenant_id" = $1 AND k."rca_id" = r."id" AND k."link_type" = 'event'
       AND ($3::uuid[] IS NULL OR e."unit_id" = ANY($3::uuid[]))
     ORDER BY k."linked_at", k."id"
     LIMIT 1
  ) t ON true
  LEFT JOIN LATERAL (
    SELECT count(*) FILTER (WHERE a."status"::text <> 'cancelled') AS "total",
           count(*) FILTER (WHERE a."status"::text = 'done') AS "done",
           count(*) FILTER (WHERE ${actionOverdueSql('a')}) AS "overdue"
      FROM "rca_actions" a
     WHERE a."tenant_id" = $1 AND a."rca_id" = r."id"
  ) c ON true`;

const iso = (value: Date | string) => new Date(value).toISOString();

export function toListFacts(row: FactsRow | undefined): RcaCaseListFacts {
  if (!row)
    return { trigger: null, actions: { total: 0, done: 0, overdue: 0 } };
  return {
    trigger:
      row.event_id && row.start_time && row.unit_id
        ? {
            eventId: row.event_id,
            startTime: iso(row.start_time),
            unitId: row.unit_id,
          }
        : null,
    actions: { total: row.total, done: row.done, overdue: row.overdue },
  };
}

/** Trigger and action counts of the cases of one list page, by case id. */
export async function caseListFacts(
  manager: EntityManager,
  scope: RcaScope,
  rcaIds: string[],
): Promise<Map<string, RcaCaseListFacts>> {
  if (rcaIds.length === 0) return new Map();
  const rows: FactsRow[] = await manager.query(CASE_LIST_FACTS_SQL, [
    scope.tenantId,
    rcaIds,
    scope.units,
  ]);
  return new Map(rows.map((row) => [row.rca_id, toListFacts(row)]));
}
