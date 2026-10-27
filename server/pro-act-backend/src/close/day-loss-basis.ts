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
