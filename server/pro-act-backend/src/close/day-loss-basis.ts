import { EntityManager } from 'typeorm';
import { parseLossAccounting } from '../periods/loss-accounting-policy';

/**
 * The `loss_accounting` body each revision's current run was calculated with (its policy snapshot, not
 * today's policy). Uses the primary keys of accounting_revisions, calculation_runs and accounting_policies.
 */
const RUN_BASIS_SQL = `SELECT p."body"
  FROM "accounting_revisions" r
  JOIN "calculation_runs" c ON c."id" = r."current_run_id"
  JOIN LATERAL jsonb_array_elements(c."policy_versions") v ON v->>'kind' = 'loss_accounting'
  JOIN "accounting_policies" p ON p."id" = (v->>'id')::uuid
 WHERE r."tenant_id" = $1 AND r."id" = ANY($2::uuid[])`;

/** True when any of the day's shift runs was calculated in declared mode (the figures the gate must follow). */
export async function dayIsDeclared(
  manager: EntityManager,
  tenantId: string,
  revisionIds: readonly string[],
): Promise<boolean> {
  if (revisionIds.length === 0) return false;
  const rows: Array<{ body: unknown }> = await manager.query(RUN_BASIS_SQL, [
    tenantId,
    revisionIds,
  ]);
  return rows.some(
    (row) => parseLossAccounting(row.body).lossBasis === 'declared',
  );
}

/**
 * Revisions whose current run was calculated in declared mode but has no figures: the period has no
 * active slice or the run no slice totals (an empty declared period is never certifiable). Uses the
 * primary keys, IDX_period_product_slices_period and UQ_period_ledger_totals_run_slice_ledger.
 */
const DECLARED_EMPTY_SQL = `SELECT r."id"
  FROM "accounting_revisions" r
  JOIN "calculation_runs" c ON c."id" = r."current_run_id"
  JOIN LATERAL jsonb_array_elements(c."policy_versions") v ON v->>'kind' = 'loss_accounting'
  JOIN "accounting_policies" p ON p."id" = (v->>'id')::uuid
 WHERE r."tenant_id" = $1 AND r."id" = ANY($2::uuid[]) AND p."body"->>'lossBasis' = 'declared'
   AND (NOT EXISTS (SELECT 1 FROM "period_ledger_totals" t WHERE t."run_id" = c."id")
     OR NOT EXISTS (SELECT 1 FROM "period_product_slices" s
                     WHERE s."period_id" = r."period_id" AND s."superseded_at" IS NULL))`;

/** Ids of the revisions (of `revisionIds`) whose declared run has no production loss figures. */
export async function declaredEmptyRevisions(
  manager: EntityManager,
  tenantId: string,
  revisionIds: readonly string[],
): Promise<string[]> {
  if (revisionIds.length === 0) return [];
  const rows: Array<{ id: string }> = await manager.query(DECLARED_EMPTY_SQL, [
    tenantId,
    revisionIds,
  ]);
  return rows.map((row) => row.id);
}
