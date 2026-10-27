import { EntityManager } from 'typeorm';
import {
  LossBasis,
  lossBasisForUnit,
  parseLossAccounting,
} from '../periods/loss-accounting-policy';

/**
 * The `loss_accounting` body each revision's current run was calculated with (its policy snapshot, not
 * today's policy; null for a run older than declared mode) and the period's unit. Uses the primary keys of accounting_revisions, production_periods,
 * calculation_runs and accounting_policies.
 */
const RUN_BASIS_SQL = `SELECT p."body", pp."unit_id"
  FROM "accounting_revisions" r
  JOIN "production_periods" pp ON pp."id" = r."period_id"
  JOIN "calculation_runs" c ON c."id" = r."current_run_id"
  LEFT JOIN LATERAL jsonb_array_elements(c."policy_versions") v ON v->>'kind' = 'loss_accounting'
  LEFT JOIN "accounting_policies" p ON p."id" = (v->>'id')::uuid
 WHERE r."tenant_id" = $1 AND r."id" = ANY($2::uuid[])`;

/**
 * The loss basis of the day's current runs: `declared` when any run was calculated in declared mode (the
 * figures the gate must follow; a declared snapshot counts only on its accounting unit), `computed` when the
 * runs were not, null when no period of the day has a run yet.
 */
export async function dayLossBasis(
  manager: EntityManager,
  tenantId: string,
  revisionIds: readonly string[],
): Promise<LossBasis | null> {
  if (revisionIds.length === 0) return null;
  const rows: Array<{ body: unknown; unit_id: string }> = await manager.query(
    RUN_BASIS_SQL,
    [tenantId, revisionIds],
  );
  if (rows.length === 0) return null;
  const declared = rows.some(
    (row) =>
      row.body !== null &&
      lossBasisForUnit(parseLossAccounting(row.body), row.unit_id) ===
        'declared',
  );
  return declared ? 'declared' : 'computed';
}

/** True when any of the day's runs was calculated in declared mode (see `dayLossBasis`). */
export async function dayIsDeclared(
  manager: EntityManager,
  tenantId: string,
  revisionIds: readonly string[],
): Promise<boolean> {
  return (await dayLossBasis(manager, tenantId, revisionIds)) === 'declared';
}

/**
 * Revisions whose current run was calculated in declared mode but has no figures: the period has no
 * active slice or the run no slice totals (an empty declared period is never certifiable). A declared
 * snapshot counts only on its accounting unit (`accountingUnitId` null or the period's unit). Uses the
 * primary keys, IDX_period_product_slices_period and UQ_period_ledger_totals_run_slice_ledger.
 */
const DECLARED_EMPTY_SQL = `SELECT r."id"
  FROM "accounting_revisions" r
  JOIN "production_periods" pp ON pp."id" = r."period_id"
  JOIN "calculation_runs" c ON c."id" = r."current_run_id"
  JOIN LATERAL jsonb_array_elements(c."policy_versions") v ON v->>'kind' = 'loss_accounting'
  JOIN "accounting_policies" p ON p."id" = (v->>'id')::uuid
 WHERE r."tenant_id" = $1 AND r."id" = ANY($2::uuid[]) AND p."body"->>'lossBasis' = 'declared'
   AND (p."body"->>'accountingUnitId' IS NULL OR lower(p."body"->>'accountingUnitId') = pp."unit_id"::text)
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
