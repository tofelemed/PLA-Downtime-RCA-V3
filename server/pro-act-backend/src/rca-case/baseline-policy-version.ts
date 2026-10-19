import { EntityManager } from 'typeorm';
import { RcaAction } from '../rca/entities/rca-action.entity';
import { RCA } from '../rca/rca.entity';

/** The version frozen with the baseline's criteria (baselines from 19 Oct 2026), else undefined. */
export const frozenPolicyVersion = (
  action: Pick<RcaAction, 'baseline'>,
): number | undefined => action.baseline?.criteria?.policyVersion;

/** Instants of the baselines whose criteria were frozen before the version was stored with them. */
function unnamedInstants(actions: readonly RcaAction[]): string[] {
  const instants = actions.flatMap((action) =>
    action.baseline?.criteria &&
    frozenPolicyVersion(action) === undefined &&
    action.baseline.computedAt
      ? [action.baseline.computedAt]
      : [],
  );
  return [...new Set(instants)];
}

/**
 * QA L11 (re-test): the `rca_policy` version an older baseline's thresholds were frozen from — the case's
 * unit version, else the tenant-wide one, in force when the baseline was computed (the rule
 * `casePolicyVersion` applied then). Read only: never seeds a policy. Keyed by the baseline's `computedAt`.
 */
export async function policyVersionsAt(
  manager: EntityManager,
  rca: Pick<RCA, 'tenantId' | 'unitId'>,
  actions: readonly RcaAction[],
): Promise<Map<string, number>> {
  const instants = unnamedInstants(actions);
  if (instants.length === 0 || !rca.tenantId) return new Map();
  const rows: Array<{ at: string; version: number | null }> =
    await manager.query(
      `SELECT t."at", (SELECT p."version" FROM "accounting_policies" p
                      WHERE p."tenant_id" = $1 AND p."policy_kind" = 'rca_policy'
                        AND (p."unit_id" = $2::uuid OR p."unit_id" IS NULL)
                        AND p."effective_from" <= t."at"::timestamptz
                        AND (p."effective_to" IS NULL OR p."effective_to" > t."at"::timestamptz)
                      ORDER BY p."unit_id" IS NULL, p."version" DESC LIMIT 1) AS "version"
       FROM unnest($3::text[]) AS t("at")`,
      [rca.tenantId, rca.unitId ?? null, instants],
    );
  return new Map(
    rows.flatMap((row) =>
      row.version === null ? [] : [[row.at, Number(row.version)] as const],
    ),
  );
}

/** The policy version of an action's baseline thresholds: frozen with them, else the one in force then. */
export function baselinePolicyVersion(
  action: Pick<RcaAction, 'baseline'>,
  versionsAt: ReadonlyMap<string, number>,
): number | null {
  const frozen = frozenPolicyVersion(action);
  if (frozen !== undefined) return frozen;
  const at = action.baseline?.computedAt;
  return at ? (versionsAt.get(at) ?? null) : null;
}
