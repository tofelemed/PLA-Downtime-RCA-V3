import { EntityManager } from 'typeorm';

/** Workflow of the accounting of the periods an event overlaps (the period grid's `workflowState`). */
export type EventAccountingState =
  | 'none'
  | 'draft'
  | 'in_review'
  | 'stale'
  | 'approved';

/**
 * Per listed event, the workflow state of each overlapping period's shown revision (latest non-cancelled,
 * `in_review` + stale = `stale`, the period grid's rule). Overlap is half-open on the unit; an open event
 * runs to now. One query per page: `UQ_production_periods_unit_start` finds the periods,
 * `UQ_accounting_revisions_period_revision` the latest revision.
 */
const STATES_SQL = `SELECT e."id" AS "event_id", w."state"
  FROM "production_events" e
  JOIN "production_periods" p
    ON p."tenant_id" = e."tenant_id" AND p."unit_id" = e."unit_id"
   AND p."utc_start" < COALESCE(e."end_time", now()) AND p."utc_end" > e."start_time"
  CROSS JOIN LATERAL (
    SELECT CASE WHEN r."lifecycle" = 'in_review' AND r."is_stale" THEN 'stale' ELSE r."lifecycle"::text END AS "state"
      FROM "accounting_revisions" r
     WHERE r."period_id" = p."id" AND r."lifecycle" <> 'cancelled'
     ORDER BY r."revision" DESC LIMIT 1
  ) w
 WHERE e."tenant_id" = $1 AND e."id" = ANY($2::uuid[])`;

/**
 * Which overlapping period state the event shows when its periods differ: open work first (in review,
 * then stale, then draft), approved only when every calculated period is approved.
 */
const PRECEDENCE: readonly EventAccountingState[] = [
  'in_review',
  'stale',
  'draft',
  'approved',
];

/** The state an event shows for its overlapping periods' states (`none` when no period has a revision). */
export function eventAccountingStateOf(
  states: readonly string[],
): EventAccountingState {
  return PRECEDENCE.find((state) => states.includes(state)) ?? 'none';
}

/**
 * Owner finding 2 (18 Oct 2026): every role reads the same server state, so the list and the single read
 * carry the accounting workflow of the event's periods next to its coding state (additive field).
 */
export async function withAccountingStates<T extends { id: string }>(
  manager: EntityManager,
  tenantId: string,
  views: readonly T[],
): Promise<Array<T & { accountingState: EventAccountingState }>> {
  const ids = views.map((view) => view.id);
  const rows =
    ids.length === 0
      ? []
      : await manager.query<Array<{ event_id: string; state: string }>>(
          STATES_SQL,
          [tenantId, ids],
        );
  const byEvent = new Map<string, string[]>();
  for (const row of rows) {
    byEvent.set(row.event_id, [
      ...(byEvent.get(row.event_id) ?? []),
      row.state,
    ]);
  }
  return views.map((view) => ({
    ...view,
    accountingState: eventAccountingStateOf(byEvent.get(view.id) ?? []),
  }));
}
