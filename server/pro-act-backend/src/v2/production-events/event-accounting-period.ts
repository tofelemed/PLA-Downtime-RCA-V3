import { EntityManager } from 'typeorm';

/** The accounting period an event belongs to (Task 13 "View accounting"): the first period it overlaps. */
export interface EventAccountingPeriodView {
  periodId: string;
  utcStart: string;
  utcEnd: string;
  localDate: string;
  shiftName: string | null;
}

/**
 * Per listed event, the earliest production period of its unit it overlaps (half-open; an open event runs to
 * now) — the period whose statement the event page links to. Excluded periods (`is_excluded`) are skipped:
 * they are never accounted, so "View accounting" never lands on one. One query per page, served by
 * `UQ_production_periods_unit_start`.
 */
const PERIOD_SQL = `SELECT DISTINCT ON (e."id") e."id" AS "eventId", p."id" AS "periodId",
       p."utc_start" AS "utcStart", p."utc_end" AS "utcEnd", p."local_date"::text AS "localDate", p."shift_name" AS "shiftName"
  FROM "production_events" e
  JOIN "production_periods" p
    ON p."tenant_id" = e."tenant_id" AND p."unit_id" = e."unit_id"
   AND p."utc_start" < COALESCE(e."end_time", now()) AND p."utc_end" > e."start_time"
   AND p."is_excluded" = false
 WHERE e."tenant_id" = $1 AND e."id" = ANY($2::uuid[])
 ORDER BY e."id", p."utc_start"`;

interface PeriodRow {
  eventId: string;
  periodId: string;
  utcStart: Date;
  utcEnd: Date;
  localDate: string;
  shiftName: string | null;
}

/** The accounting period of each event (null when no period covers it yet). */
export async function accountingPeriodsOf(
  manager: EntityManager,
  tenantId: string,
  eventIds: readonly string[],
): Promise<Map<string, EventAccountingPeriodView>> {
  if (eventIds.length === 0) return new Map();
  const rows = await manager.query<PeriodRow[]>(PERIOD_SQL, [
    tenantId,
    eventIds,
  ]);
  return new Map(
    rows.map((row) => [
      row.eventId,
      {
        periodId: row.periodId,
        utcStart: new Date(row.utcStart).toISOString(),
        utcEnd: new Date(row.utcEnd).toISOString(),
        localDate: row.localDate,
        shiftName: row.shiftName,
      },
    ]),
  );
}
