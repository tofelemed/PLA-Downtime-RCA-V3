import { EntityManager } from 'typeorm';
import { addDays } from '../domain/calendar/wall-clock';
import { endOfLocalDay } from './close-calendar';
import { planCoveredSql } from './plan-coverage-sql';
import {
  MonthDates,
  MonthPrerequisites,
  PREREQUISITE_LIST_LIMIT,
} from './month-prerequisites';
import { MonthUncovered } from './month-uncovered';

/** A scheduled shift of the month that has no production period yet (it cannot be approved). */
export interface MissingPeriod {
  unitId: string;
  unitName: string | null;
  localDate: string;
  shiftName: string;
  utcStart: string;
}

export interface MonthCoverage {
  missingPeriodCount: number;
  missingPeriods: MissingPeriod[];
  /**
   * When the month is over: the later of the end of its last local date and the end of its last shift or
   * period (a production day runs past local midnight, e.g. 06:00 → 06:00).
   */
  endsAt: Date;
}

/** The month close prerequisites with the periods still to be created, and the days no plan covers (information). */
export type ClosePrerequisites = MonthPrerequisites &
  Pick<MonthCoverage, 'missingPeriodCount' | 'missingPeriods'> &
  MonthUncovered;

/**
 * Shift instances of the month (not excluded, the unit with an approved profile at the shift start) that no
 * production period covers: the periods the materializer is still to create. Same overlap test as the
 * materializer, so an instance it skipped because a period of other bounds covers it is not missing. A shift
 * no approved plan covers is not expected yet (owner decision 2026-10-19; listed by `month-uncovered.ts`).
 * $1 tenant, $2 first date, $3 end date (exclusive). Uses IDX_shift_instances_tenant_unit_date and
 * EX_production_periods_unit_no_overlap.
 */
const MISSING = `FROM "shift_instances" si
 WHERE si."tenant_id" = $1 AND si."unit_id" IN (SELECT u."id" FROM "units" u WHERE u."tenant_id" = $1)
   AND si."local_date" >= $2 AND si."local_date" < $3 AND NOT si."is_excluded"
   AND EXISTS (SELECT 1 FROM "production_profiles" pp
                WHERE pp."tenant_id" = $1 AND pp."unit_id" = si."unit_id" AND pp."state" = 'approved'
                  AND pp."effective_from" <= si."utc_start"
                  AND (pp."effective_to" IS NULL OR pp."effective_to" > si."utc_start"))
   AND NOT EXISTS (SELECT 1 FROM "production_periods" p
                    WHERE p."unit_id" = si."unit_id"
                      AND tstzrange(p."utc_start", p."utc_end", '[)') && tstzrange(si."utc_start", si."utc_end", '[)'))
   AND ${planCoveredSql('si', false)}`;

const LAST_END = `SELECT max(e) AS "last_end" FROM (
  SELECT max(si."utc_end") AS e FROM "shift_instances" si
   WHERE si."tenant_id" = $1 AND si."unit_id" IN (SELECT u."id" FROM "units" u WHERE u."tenant_id" = $1)
     AND si."local_date" >= $2 AND si."local_date" < $3
  UNION ALL
  SELECT max(p."utc_end") FROM "production_periods" p
   WHERE p."tenant_id" = $1 AND p."local_date" >= $2 AND p."local_date" < $3) x`;

async function missingPeriods(
  manager: EntityManager,
  params: unknown[],
): Promise<{ count: number; items: MissingPeriod[] }> {
  const [{ count }]: Array<{ count: number }> = await manager.query(
    `SELECT count(*)::int AS "count" ${MISSING}`,
    params,
  );
  if (count === 0) return { count, items: [] };
  const rows: Array<Record<string, string | null>> = await manager.query(
    `SELECT si."unit_id", (SELECT u."name" FROM "units" u WHERE u."id" = si."unit_id") AS "unit_name",
            to_char(si."local_date", 'YYYY-MM-DD') AS "local_date", si."shift_name", si."utc_start"
       ${MISSING} ORDER BY si."utc_start", si."unit_id" LIMIT ${PREREQUISITE_LIST_LIMIT}`,
    params,
  );
  return {
    count,
    items: rows.map((r) => ({
      unitId: r.unit_id as string,
      unitName: r.unit_name,
      localDate: r.local_date as string,
      shiftName: r.shift_name as string,
      utcStart: new Date(r.utc_start as string).toISOString(),
    })),
  };
}

/** The month's periods still to be created and the instant the month is over (plant time zone). */
export async function monthCoverage(
  manager: EntityManager,
  month: MonthDates,
  timezone: string,
): Promise<MonthCoverage> {
  const params = [month.tenantId, month.firstDate, month.endDate];
  const missing = await missingPeriods(manager, params);
  const [{ last_end }]: Array<{ last_end: Date | string | null }> =
    await manager.query(LAST_END, params);
  const localEnd = endOfLocalDay(addDays(month.endDate, -1), timezone);
  const lastEnd = last_end ? new Date(last_end) : null;
  return {
    missingPeriodCount: missing.count,
    missingPeriods: missing.items,
    endsAt: lastEnd && lastEnd > localEnd ? lastEnd : localEnd,
  };
}
