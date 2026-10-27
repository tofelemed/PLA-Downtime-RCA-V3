import { EntityManager } from 'typeorm';

/** Period history that cannot be deleted: runs, revisions, proposals, line sets, postings, holds, adjustments. */
const HAS_HISTORY = `(
  EXISTS (SELECT 1 FROM "actuals_runs" x WHERE x."period_id" = p."id")
  OR EXISTS (SELECT 1 FROM "calculation_runs" x WHERE x."period_id" = p."id")
  OR EXISTS (SELECT 1 FROM "accounting_revisions" x WHERE x."period_id" = p."id")
  OR EXISTS (SELECT 1 FROM "period_change_proposals" x WHERE x."period_id" = p."id")
  OR EXISTS (SELECT 1 FROM "reconciliation_line_sets" x WHERE x."period_id" = p."id")
  OR EXISTS (SELECT 1 FROM "restatement_postings" x WHERE x."period_id" = p."id")
  OR EXISTS (SELECT 1 FROM "period_data_holds" x WHERE x."period_id" = p."id")
  OR EXISTS (SELECT 1 FROM "actuals_adjustments" a JOIN "period_product_slices" s ON s."id" = a."slice_id"
              WHERE s."period_id" = p."id"))`;

export interface RetirementScope {
  tenantId: string;
  unitIds: string[];
  calendarVersionId: string;
  /** first operational date of the new daily instances */
  fromDate: string;
}

export interface RetirementResult {
  /** open periods deleted so that a daily period can take their place */
  retired: number;
  /** daily instances left to the old periods because one of them has calculation history */
  keptInstances: number;
}

interface Overlap {
  instance_id: string;
  period_id: string;
  blocked: boolean;
}

/**
 * The latest operational date of a period with an approved revision on or after `fromDate` (a period
 * the daily calendar must not replace), or null.
 */
export async function latestApprovedPeriodDate(
  manager: EntityManager,
  scope: { tenantId: string; unitIds: string[]; fromDate: string },
): Promise<string | null> {
  const [row] = await manager.query<Array<{ latest: string | null }>>(
    `SELECT to_char(max(p."local_date"), 'YYYY-MM-DD') AS "latest" FROM "production_periods" p
      WHERE p."tenant_id" = $1 AND p."unit_id" = ANY($2::uuid[]) AND p."local_date" >= $3::date
        AND EXISTS (SELECT 1 FROM "accounting_revisions" r WHERE r."period_id" = p."id" AND r."lifecycle" = 'approved')`,
    [scope.tenantId, scope.unitIds, scope.fromDate],
  );
  return row?.latest ?? null;
}

/**
 * Open periods that overlap a daily instance of the new calendar (D12): periods without calculation
 * history are deleted with their slices and queued jobs, so the period materializer can create the daily
 * period. An instance where any overlapping period has history (or began before the instance) is left to
 * the old periods — the append-only ledgers forbid deleting them.
 */
export async function retireOpenPeriods(
  manager: EntityManager,
  scope: RetirementScope,
): Promise<RetirementResult> {
  const overlaps = await manager.query<Overlap[]>(
    `SELECT si."id" AS "instance_id", p."id" AS "period_id",
            (p."utc_start" < si."utc_start" OR ${HAS_HISTORY}) AS "blocked"
       FROM "shift_instances" si
       JOIN "production_periods" p ON p."unit_id" = si."unit_id"
        AND tstzrange(p."utc_start", p."utc_end", '[)') && tstzrange(si."utc_start", si."utc_end", '[)')
        AND NOT (p."utc_start" = si."utc_start" AND p."utc_end" = si."utc_end")
      WHERE si."tenant_id" = $1 AND si."calendar_version_id" = $2 AND si."local_date" >= $3::date
        AND si."unit_id" = ANY($4::uuid[])`,
    [scope.tenantId, scope.calendarVersionId, scope.fromDate, scope.unitIds],
  );
  const blocked = new Set(
    overlaps.filter((o) => o.blocked).map((o) => o.instance_id),
  );
  const kept = new Set(
    overlaps.filter((o) => blocked.has(o.instance_id)).map((o) => o.period_id),
  );
  const retire = [
    ...new Set(overlaps.map((o) => o.period_id).filter((id) => !kept.has(id))),
  ];
  if (retire.length > 0) await deletePeriods(manager, retire);
  return { retired: retire.length, keptInstances: blocked.size };
}

async function deletePeriods(
  manager: EntityManager,
  periodIds: string[],
): Promise<void> {
  await manager.query(
    `DELETE FROM "actuals_jobs" WHERE "period_id" = ANY($1::uuid[])`,
    [periodIds],
  );
  await manager.query(
    `DELETE FROM "period_product_slices" WHERE "period_id" = ANY($1::uuid[])`,
    [periodIds],
  );
  await manager.query(
    `DELETE FROM "production_periods" WHERE "id" = ANY($1::uuid[])`,
    [periodIds],
  );
}
