import { EntityManager } from 'typeorm';
import { planCoveredSql } from './plan-coverage-sql';
import { MonthDates, PREREQUISITE_LIST_LIMIT } from './month-prerequisites';

/** A production day of a unit with periods or scheduled shifts that no approved plan covers. */
export interface UncoveredDay {
  unitId: string;
  unitName: string | null;
  localDate: string;
  /** periods and scheduled shifts of the day without a plan */
  shifts: number;
}

/** Information only: never a close prerequisite (owner decision 2026-10-19, QA audit P-0). */
export interface MonthUncovered {
  uncoveredDayCount: number;
  uncoveredDays: UncoveredDay[];
}

/**
 * Periods of the month (not excluded-and-unreconciled) and scheduled shifts without a period (approved
 * profile, as `month-coverage.ts`) that no approved plan covers, per unit and date. $1 tenant, $2 first
 * date, $3 end date (exclusive).
 */
const UNCOVERED = `WITH x AS (
  SELECT p."unit_id", p."local_date" FROM "production_periods" p
   WHERE p."tenant_id" = $1 AND p."local_date" >= $2 AND p."local_date" < $3
     AND NOT (p."is_excluded" AND NOT EXISTS (SELECT 1 FROM "accounting_revisions" ar
                                               WHERE ar."period_id" = p."id" AND ar."lifecycle" <> 'cancelled'))
     AND NOT ${planCoveredSql('p')}
  UNION ALL
  SELECT si."unit_id", si."local_date" FROM "shift_instances" si
   WHERE si."tenant_id" = $1 AND si."local_date" >= $2 AND si."local_date" < $3 AND NOT si."is_excluded"
     AND EXISTS (SELECT 1 FROM "production_profiles" pp
                  WHERE pp."tenant_id" = $1 AND pp."unit_id" = si."unit_id" AND pp."state" = 'approved'
                    AND pp."effective_from" <= si."utc_start"
                    AND (pp."effective_to" IS NULL OR pp."effective_to" > si."utc_start"))
     AND NOT EXISTS (SELECT 1 FROM "production_periods" q
                      WHERE q."unit_id" = si."unit_id"
                        AND tstzrange(q."utc_start", q."utc_end", '[)') && tstzrange(si."utc_start", si."utc_end", '[)'))
     AND NOT ${planCoveredSql('si', false)}
), d AS (SELECT x."unit_id", x."local_date", count(*)::int AS "shifts" FROM x GROUP BY x."unit_id", x."local_date")`;

/** The month's production days that wait for a plan (counts complete, list capped). */
export async function monthUncovered(
  manager: EntityManager,
  month: MonthDates,
): Promise<MonthUncovered> {
  const params = [month.tenantId, month.firstDate, month.endDate];
  const [{ count }]: Array<{ count: number }> = await manager.query(
    `${UNCOVERED} SELECT count(*)::int AS "count" FROM d`,
    params,
  );
  if (count === 0) return { uncoveredDayCount: 0, uncoveredDays: [] };
  const rows: Array<{
    unit_id: string;
    unit_name: string | null;
    local_date: string;
    shifts: number;
  }> = await manager.query(
    `${UNCOVERED}
     SELECT d."unit_id", u."name" AS "unit_name", to_char(d."local_date", 'YYYY-MM-DD') AS "local_date", d."shifts"
       FROM d LEFT JOIN "units" u ON u."id" = d."unit_id"
      ORDER BY d."local_date", d."unit_id" LIMIT ${PREREQUISITE_LIST_LIMIT}`,
    params,
  );
  return {
    uncoveredDayCount: count,
    uncoveredDays: rows.map((r) => ({
      unitId: r.unit_id,
      unitName: r.unit_name,
      localDate: r.local_date,
      shifts: r.shifts,
    })),
  };
}
