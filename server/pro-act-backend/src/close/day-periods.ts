import { EntityManager } from 'typeorm';
import { DayPeriod } from '../domain/close/day-certification';

/** A period of a production day with its latest revision that is not cancelled. */
export interface DayPeriodRow extends DayPeriod {
  unitId: string;
  localDate: string;
  shiftName: string | null;
  utcStart: Date;
  revisionId: string | null;
  revision: number | null;
}

interface SqlRow {
  id: string;
  unit_id: string;
  local_date: string;
  shift_name: string | null;
  utc_start: Date;
  is_excluded: boolean;
  revision_id: string | null;
  revision: number | null;
  workflow: string;
  submitted_by: string | null;
}

/**
 * Periods of units on operational dates `[from, to]` with their latest revision not cancelled, in time
 * order. $1 tenant, $2 units, $3 from, $4 to. Uses IDX_production_periods_tenant_date.
 */
export async function dayPeriods(
  manager: EntityManager,
  input: { tenantId: string; unitIds: string[]; from: string; to: string },
): Promise<DayPeriodRow[]> {
  const rows: SqlRow[] = await manager.query(
    `SELECT p."id", p."unit_id", to_char(p."local_date", 'YYYY-MM-DD') AS "local_date", p."shift_name",
            p."utc_start", p."is_excluded", r."id" AS "revision_id", r."revision", r."submitted_by",
            CASE WHEN r."lifecycle" IS NULL THEN 'none'
                 WHEN r."lifecycle" = 'in_review' AND r."is_stale" THEN 'stale'
                 ELSE r."lifecycle"::text END AS "workflow"
       FROM "production_periods" p
       LEFT JOIN LATERAL (SELECT ar."id", ar."revision", ar."lifecycle", ar."is_stale", ar."submitted_by"
                            FROM "accounting_revisions" ar
                           WHERE ar."period_id" = p."id" AND ar."lifecycle" <> 'cancelled'
                           ORDER BY ar."revision" DESC LIMIT 1) r ON true
      WHERE p."tenant_id" = $1 AND p."unit_id" = ANY($2::uuid[])
        AND p."local_date" >= $3::date AND p."local_date" <= $4::date
      ORDER BY p."unit_id", p."utc_start"`,
    [input.tenantId, input.unitIds, input.from, input.to],
  );
  return rows.map((r) => ({
    periodId: r.id,
    unitId: r.unit_id,
    localDate: r.local_date,
    shiftName: r.shift_name,
    utcStart: new Date(r.utc_start),
    isExcluded: r.is_excluded,
    revisionId: r.revision_id,
    revision: r.revision,
    workflow: r.workflow,
    submittedBy: r.submitted_by,
  }));
}
