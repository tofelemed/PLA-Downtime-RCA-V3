import { EntityManager } from 'typeorm';
import { actionOverdueSql } from '../../rca-case/action-overdue';
import { ReportScope } from '../reports/report-scope';

/** Age buckets (days since a case or action was opened). */
export const AGE_BUCKETS = ['0-30', '31-60', '61-90', '90+'] as const;
/** Where an open action stands against its due date. */
export const DUE_BUCKETS = [
  'overdue',
  'due_7_days',
  'later',
  'no_due_date',
] as const;

export interface CountView {
  key: string;
  count: number;
}

/** RCA pipeline and action discipline (R10), as of now and for the closures in the window. */
export interface RcaActionTrackerView {
  openCases: {
    total: number;
    overdue: number;
    byStatus: CountView[];
    byAge: CountView[];
  };
  openActions: { total: number; byDue: CountView[]; byAge: CountView[] };
  /** actions done in the window: with a due date, on time (done by the end of the due date), late */
  closedActions: {
    done: number;
    withDueDate: number;
    onTime: number;
    late: number;
    onTimeRate: string | null;
  };
  /** cases whose closure was approved in the window, and the mean days from opening to closure */
  closedCases: { closed: number; meanDaysToClose: string | null };
  asOf: string;
}

const AGE = (
  column: string,
) => `CASE WHEN now() - ${column} <= interval '30 days' THEN '0-30'
       WHEN now() - ${column} <= interval '60 days' THEN '31-60'
       WHEN now() - ${column} <= interval '90 days' THEN '61-90' ELSE '90+' END`;

/** $1 tenant, $2 units (null = every unit, also tenant-wide cases). */
const CASES = `FROM "rcas" r WHERE r."tenant_id" = $1 AND ($2::uuid[] IS NULL OR r."unit_id" = ANY($2::uuid[]))`;

const OPEN_CASES_SQL = `SELECT r."status" AS "status", ${AGE('r."created_at"')} AS "age",
       count(*)::int AS "count",
       count(*) FILTER (WHERE r."target_completion_date" < now())::int AS "overdue"
  ${CASES} AND r."status" IS DISTINCT FROM 'Closed'
 GROUP BY 1, 2`;

const OPEN_ACTIONS_SQL = `SELECT CASE WHEN ${actionOverdueSql('a')} THEN 'overdue'
            WHEN a."due_date" IS NULL THEN 'no_due_date'
            WHEN a."due_date" < now() + interval '7 days' THEN 'due_7_days' ELSE 'later' END AS "due",
       ${AGE('a."created_at"')} AS "age", count(*)::int AS "count"
  FROM "rca_actions" a JOIN "rcas" r ON r."id" = a."rca_id" AND r."tenant_id" = $1
 WHERE a."tenant_id" = $1 AND ($2::uuid[] IS NULL OR r."unit_id" = ANY($2::uuid[]))
   AND a."status"::text IN ('open', 'in_progress')
 GROUP BY 1, 2`;

/** $3, $4 window. On time = completed before the end of the due date's day (UTC). */
const CLOSED_ACTIONS_SQL = `SELECT count(*)::int AS "done", count(a."due_date")::int AS "with_due",
       count(*) FILTER (WHERE a."completed_at" < date_trunc('day', a."due_date") + interval '1 day')::int AS "on_time"
  FROM "rca_actions" a JOIN "rcas" r ON r."id" = a."rca_id" AND r."tenant_id" = $1
 WHERE a."tenant_id" = $1 AND ($2::uuid[] IS NULL OR r."unit_id" = ANY($2::uuid[]))
   AND a."status"::text = 'done' AND a."completed_at" >= $3 AND a."completed_at" < $4`;

const CLOSED_CASES_SQL = `SELECT count(*)::int AS "closed",
       (avg(extract(epoch FROM r."closure_approved_at" - r."created_at")) / 86400)::numeric(12,1)::text AS "mean_days"
  ${CASES} AND r."closure_approved_at" >= $3 AND r."closure_approved_at" < $4`;

interface OpenCaseRow {
  status: string | null;
  age: string;
  count: number;
  overdue: number;
}

/** Counts per key; the keys of `order` come first, with 0 when no row has them. */
function tally<T extends { count: number }>(
  rows: readonly T[],
  keyOf: (row: T) => string,
  order: readonly string[] = [],
): CountView[] {
  const counts = new Map<string, number>(order.map((k) => [k, 0]));
  for (const row of rows) {
    const key = keyOf(row);
    counts.set(key, (counts.get(key) ?? 0) + row.count);
  }
  return [...counts.entries()].map(([key, count]) => ({ key, count }));
}

const sumOf = (rows: ReadonlyArray<{ count: number }>) =>
  rows.reduce((n, r) => n + r.count, 0);

/** On-time share of the actions done in the window that had a due date (decimal string), null without any. */
export function onTimeRate(onTime: number, withDue: number): string | null {
  return withDue === 0
    ? null
    : (onTime / withDue).toFixed(4).replace(/\.?0+$/, '');
}

/**
 * `GET /reports/rca-action-tracker` (R10): open RCA cases and actions by status, age and due date (as of
 * now), and the closures of the window — actions done on time against their due date, cases closed and
 * the mean days to close. Cases of the units in scope; a tenant-wide caller without units also sees
 * tenant-wide cases.
 */
export async function rcaActionTracker(
  manager: EntityManager,
  scope: ReportScope,
  units: string[] | null,
): Promise<RcaActionTrackerView> {
  const base = [scope.tenantId, units];
  const window = [...base, scope.from, scope.to];
  const [cases, actions, [closedActions], [closedCases]] = await Promise.all([
    manager.query<OpenCaseRow[]>(OPEN_CASES_SQL, base),
    manager.query<Array<{ due: string; age: string; count: number }>>(
      OPEN_ACTIONS_SQL,
      base,
    ),
    manager.query<Array<{ done: number; with_due: number; on_time: number }>>(
      CLOSED_ACTIONS_SQL,
      window,
    ),
    manager.query<Array<{ closed: number; mean_days: string | null }>>(
      CLOSED_CASES_SQL,
      window,
    ),
  ]);
  return {
    openCases: {
      total: sumOf(cases),
      overdue: cases.reduce((n, r) => n + r.overdue, 0),
      byStatus: tally(cases, (r) => r.status ?? 'No status'),
      byAge: tally(cases, (r) => r.age, AGE_BUCKETS),
    },
    openActions: {
      total: sumOf(actions),
      byDue: tally(actions, (r) => r.due, DUE_BUCKETS),
      byAge: tally(actions, (r) => r.age, AGE_BUCKETS),
    },
    closedActions: {
      done: closedActions.done,
      withDueDate: closedActions.with_due,
      onTime: closedActions.on_time,
      late: closedActions.with_due - closedActions.on_time,
      onTimeRate: onTimeRate(closedActions.on_time, closedActions.with_due),
    },
    closedCases: {
      closed: closedCases.closed,
      meanDaysToClose: closedCases.mean_days,
    },
    asOf: new Date().toISOString(),
  };
}
