import {
  ActivityCountView,
  ActivityDayView,
  AuditActivitySummaryView,
  WorkItemSummaryView,
} from './activity-summary.view';

/**
 * SQL of the activity summary. Parameters: $1 tenant id, $2 from, $3 to (half-open, `created_at`), $4 plant
 * timezone, $5 asOf, $6 unit ids (uuid[], null = tenant-wide). One GROUP BY per source; the rows are
 * (status, priority, day) cells folded in `foldWorkItems`, so no record is loaded one by one.
 */
export const RCA_CELLS_SQL = `SELECT coalesce(nullif(r."status", ''), 'Unknown') AS "status",
       coalesce(nullif(r."priority", ''), 'Unknown') AS "priority",
       to_char(r."created_at" AT TIME ZONE $4, 'YYYY-MM-DD') AS "day",
       count(*)::int AS "n",
       count(*) FILTER (WHERE coalesce(r."status", '') NOT IN ('Closed', 'Published'))::int AS "open",
       count(*) FILTER (WHERE coalesce(r."status", '') NOT IN ('Closed', 'Published')
                          AND r."target_completion_date" < $5)::int AS "overdue"
  FROM "rcas" r
 WHERE r."tenant_id" = $1::uuid AND r."created_at" >= $2 AND r."created_at" < $3
   AND ($6::uuid[] IS NULL OR r."unit_id" = ANY($6::uuid[]))
 GROUP BY 1, 2, 3`;

export const TASK_CELLS_SQL = `SELECT coalesce(nullif(t."status", ''), 'Unknown') AS "status",
       coalesce(nullif(t."priority", ''), 'Unknown') AS "priority",
       to_char(t."created_at" AT TIME ZONE $4, 'YYYY-MM-DD') AS "day",
       count(*)::int AS "n",
       count(*) FILTER (WHERE coalesce(t."status", '') NOT IN ('Completed', 'Cancelled'))::int AS "open",
       count(*) FILTER (WHERE coalesce(t."status", '') NOT IN ('Completed', 'Cancelled')
                          AND t."due_date" < $5)::int AS "overdue"
  FROM "tasks" t
 WHERE t."tenant_id" = $1::uuid AND t."created_at" >= $2 AND t."created_at" < $3
 GROUP BY 1, 2, 3`;

/** Audit cells: $1 tenant, $2 from, $3 to, $4 timezone. */
export const AUDIT_CELLS_SQL = `SELECT coalesce(nullif(a."action", ''), 'Unknown') AS "action",
       coalesce(nullif(a."entity_type", ''), 'Unknown') AS "entity_type",
       to_char(a."created_at" AT TIME ZONE $4, 'YYYY-MM-DD') AS "day",
       count(*)::int AS "n"
  FROM "audit_logs" a
 WHERE a."tenant_id" = $1::uuid AND a."created_at" >= $2 AND a."created_at" < $3
 GROUP BY 1, 2, 3`;

/** Plant timezone: the default site's, else the plant's, else UTC — only zones Postgres knows. */
export const TIMEZONE_SQL = `SELECT coalesce(
  (SELECT s."timezone" FROM "sites" s JOIN pg_timezone_names z ON z."name" = s."timezone"
    WHERE s."tenant_id" = $1 AND s."is_default" LIMIT 1),
  (SELECT t."timezone" FROM "tenants" t JOIN pg_timezone_names z ON z."name" = t."timezone"
    WHERE t."id" = $1 LIMIT 1),
  'UTC') AS "timezone"`;

export interface WorkItemCell {
  status: string;
  priority: string;
  day: string;
  n: number;
  open: number;
  overdue: number;
}

export interface AuditCell {
  action: string;
  entity_type: string;
  day: string;
  n: number;
}

/** Counts per key, largest first, then by key (stable output for equal counts). */
function countsBy<T>(
  cells: readonly T[],
  key: (cell: T) => string,
  n: (cell: T) => number,
): ActivityCountView[] {
  const totals = new Map<string, number>();
  for (const cell of cells)
    totals.set(key(cell), (totals.get(key(cell)) ?? 0) + n(cell));
  return [...totals.entries()]
    .map(([k, count]) => ({ key: k, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function daysOf<T extends { day: string; n: number }>(
  cells: readonly T[],
): ActivityDayView[] {
  return countsBy(
    cells,
    (c) => c.day,
    (c) => c.n,
  )
    .map(({ key, count }) => ({ day: key, count }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

const sum = <T>(cells: readonly T[], n: (cell: T) => number) =>
  cells.reduce((total, cell) => total + n(cell), 0);

/** RCA case or task cells → totals, open, overdue, per status / priority / creation day. */
export function foldWorkItems(
  cells: readonly WorkItemCell[],
): WorkItemSummaryView {
  return {
    total: sum(cells, (c) => c.n),
    open: sum(cells, (c) => c.open),
    overdue: sum(cells, (c) => c.overdue),
    byStatus: countsBy(
      cells,
      (c) => c.status,
      (c) => c.n,
    ),
    byPriority: countsBy(
      cells,
      (c) => c.priority,
      (c) => c.n,
    ),
    createdByDay: daysOf(cells),
  };
}

/** Audit cells → total and counts per action, entity type and day. */
export function foldAudit(
  cells: readonly AuditCell[],
): AuditActivitySummaryView {
  return {
    total: sum(cells, (c) => c.n),
    byAction: countsBy(
      cells,
      (c) => c.action,
      (c) => c.n,
    ),
    byEntityType: countsBy(
      cells,
      (c) => c.entity_type,
      (c) => c.n,
    ),
    byDay: daysOf(cells),
  };
}
