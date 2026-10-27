import { EntityManager } from 'typeorm';
import { PolicyKind } from './entities/accounting-policy.entity';

/** One lookup: the version in force for a unit at an instant. */
export interface PolicyLookup {
  tenantId: string;
  unitId: string;
  at: Date;
}

/**
 * Same resolution as `AccountingPoliciesService` (the unit's own highest version in force at the
 * instant, else the tenant-wide one; source_authority and loss_accounting drafts never resolve) for many lookups in one statement: `unnest … WITH ORDINALITY` and a
 * LATERAL top-1 served by `IDX_accounting_policies_lookup (tenant_id, policy_kind, unit_id,
 * effective_from)`.
 */
const IN_FORCE_SQL = `SELECT k."ord"::int AS "ord", p."body"
  FROM unnest($1::uuid[], $2::uuid[], $3::timestamptz[]) WITH ORDINALITY AS k("tenant_id", "unit_id", "at", "ord")
  CROSS JOIN LATERAL (
    SELECT a."body" FROM "accounting_policies" a
     WHERE a."tenant_id" = k."tenant_id" AND a."policy_kind" = $4::accounting_policy_kind
       AND (a."unit_id" = k."unit_id" OR a."unit_id" IS NULL)
       AND a."effective_from" <= k."at" AND (a."effective_to" IS NULL OR a."effective_to" > k."at")
       AND (a."policy_kind" NOT IN ('source_authority', 'loss_accounting') OR a."approved_at" IS NOT NULL)
     ORDER BY a."unit_id" IS NULL, a."version" DESC
     LIMIT 1) p`;

/**
 * Bodies of the `kind` versions in force for each lookup, by position (`undefined` where none is in force:
 * the caller falls back to the seeding resolution). Read-only — it never seeds a default.
 */
export async function policyBodiesInForce(
  manager: EntityManager,
  kind: PolicyKind,
  lookups: readonly PolicyLookup[],
): Promise<Array<unknown>> {
  const bodies: unknown[] = new Array<unknown>(lookups.length).fill(undefined);
  if (lookups.length === 0) return bodies;
  const rows: Array<{ ord: number; body: unknown }> = await manager.query(
    IN_FORCE_SQL,
    [
      lookups.map((l) => l.tenantId),
      lookups.map((l) => l.unitId),
      lookups.map((l) => l.at),
      kind,
    ],
  );
  for (const row of rows) bodies[row.ord - 1] = row.body;
  return bodies;
}
