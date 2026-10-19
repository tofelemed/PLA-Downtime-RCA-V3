import { QueryRunner } from 'typeorm';

/** `audit_log.service` of a history entry written by a data-repair migration (no user acted). */
export const DATA_REPAIR_SERVICE = 'data_repair';

/** `audit_log.action` of such an entry on an investigation (shown as "Data repair" in its History). */
export const CASE_REPAIRED_ACTION = 'rca_case.repaired';

/** One data repair of investigations, as its History entry tells it. */
export interface CaseRepair {
  /** the repairing migration's name; marks its entries (`detail.repair`) so up is idempotent and down exact */
  name: string;
  /** what was repaired and why, in words a reader of the History understands */
  reason: string;
  /** top-level fields of the case the repair changed (`recommendations`, …) */
  changedFields: readonly string[];
}

/**
 * Appends one History entry (QA M1, DECISIONS 2026-10-19 "data repairs are recorded in the record's
 * history") for every investigation matched by `where` (SQL on `rcas r`, `$4…` for `params`): actor
 * "System" (`service` data_repair), action `rca_case.repaired`, the case's current row version and the
 * repair's reason, timed at the case's `updated_at` — the repair's write. Every repair migration that
 * changes `rcas` calls this in its `up` after its update; a case that already has the repair's entry is
 * skipped.
 */
export async function recordCaseRepair(
  runner: QueryRunner,
  repair: CaseRepair,
  where: string,
  params: readonly unknown[] = [],
): Promise<void> {
  await runner.query(
    `INSERT INTO "audit_log" ("tenant_id", "actor_id", "service", "action", "entity_type", "entity_id",
            "revision", "reason", "detail", "at")
     SELECT r."tenant_id", NULL, '${DATA_REPAIR_SERVICE}', '${CASE_REPAIRED_ACTION}', 'rca_case', r."id",
            r."row_version", $1,
            jsonb_build_object('caseId', r."id"::text, 'changedFields', $2::jsonb, 'values', '{}'::jsonb,
                               'repair', $3::text),
            COALESCE(r."updated_at", now())
       FROM "rcas" r
      WHERE r."tenant_id" IS NOT NULL
        AND (${where})
        AND NOT EXISTS (SELECT 1 FROM "audit_log" a
                         WHERE a."tenant_id" = r."tenant_id" AND a."entity_type" = 'rca_case'
                           AND a."entity_id" = r."id" AND a."detail" ->> 'repair' = $3::text)`,
    [
      repair.reason,
      JSON.stringify(repair.changedFields),
      repair.name,
      ...params,
    ],
  );
}

/**
 * `down` of `recordCaseRepair`: removes the repair's History entries. `audit_log` is append-only; its
 * trigger lets a DELETE through only under a declared retention cutoff, so this declares one for its own
 * transaction (`infinity`) and deletes exactly the entries marked with the repair's name.
 */
export async function removeCaseRepair(
  runner: QueryRunner,
  name: string,
): Promise<void> {
  const own = !runner.isTransactionActive;
  if (own) await runner.startTransaction();
  try {
    await runner.query(
      `SELECT set_config('app.audit_retention_cutoff', 'infinity', true)`,
    );
    await runner.query(
      `DELETE FROM "audit_log" WHERE "entity_type" = 'rca_case' AND "action" = $1
          AND "service" = $2 AND "detail" ->> 'repair' = $3`,
      [CASE_REPAIRED_ACTION, DATA_REPAIR_SERVICE, name],
    );
    await runner.query(
      `SELECT set_config('app.audit_retention_cutoff', '', true)`,
    );
    if (own) await runner.commitTransaction();
  } catch (error) {
    if (own) await runner.rollbackTransaction();
    throw error;
  }
}
