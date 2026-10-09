import { EntityManager } from 'typeorm';
import {
  parseValuationPolicy,
  VALUATION_POLICY_V2_BODY,
} from '../domain/valuation/valuation-policy';
import { ValuationPolicySnapshot } from '../domain/valuation/valuation.types';
import { AccountingPolicy } from '../periods/entities/accounting-policy.entity';

const KIND = 'valuation_basis';
const FIRST_USE_NOTE =
  'Seeded on first use from the D08 answer of 2026-10-09 (IRR and USD, FX snapshot); unapproved until a manager approver records the finance approval (VAL01).';

/**
 * A tenant without any `valuation_basis` version gets version 1 with the D08 body (IRR and USD), unapproved
 * — existing tenants got v1 (XXX history) and v2 from the migration. Idempotent under concurrency.
 */
export async function ensureValuationPolicy(
  manager: EntityManager,
  tenantId: string,
): Promise<void> {
  await manager.query(
    `INSERT INTO "accounting_policies" ("tenant_id", "row_version", "policy_kind", "unit_id", "scope_key",
            "version", "body", "effective_from", "approved_at", "notes")
     SELECT $1, 1, $2::accounting_policy_kind, NULL, 'tenant', 1, $3::jsonb, '1970-01-01T00:00:00Z', NULL, $4
      WHERE NOT EXISTS (SELECT 1 FROM "accounting_policies" WHERE "tenant_id" = $1 AND "policy_kind" = $2::accounting_policy_kind)
     ON CONFLICT DO NOTHING`,
    [tenantId, KIND, JSON.stringify(VALUATION_POLICY_V2_BODY), FIRST_USE_NOTE],
  );
}

export function snapshotOf(policy: AccountingPolicy): ValuationPolicySnapshot {
  return parseValuationPolicy(policy.body, {
    id: policy.id,
    version: policy.version,
    approved: policy.approvedAt !== null,
  });
}

/**
 * The `valuation_basis` version a valuation applies at an instant (VAL01): the highest **approved**
 * version in force (unit version before tenant version); when none is approved, the highest version in
 * force — which values nothing (`policy_unapproved`) but is still recorded on the run.
 */
export async function resolveValuationPolicy(
  manager: EntityManager,
  scope: { tenantId: string; unitId: string },
  at: Date,
): Promise<AccountingPolicy> {
  await ensureValuationPolicy(manager, scope.tenantId);
  const found = await manager
    .getRepository(AccountingPolicy)
    .createQueryBuilder('p')
    .where('p.tenantId = :tenantId AND p.policyKind = :kind', {
      tenantId: scope.tenantId,
      kind: KIND,
    })
    .andWhere('(p.unitId = :unitId OR p.unitId IS NULL)', {
      unitId: scope.unitId,
    })
    .andWhere(
      'p.effectiveFrom <= :at AND (p.effectiveTo IS NULL OR p.effectiveTo > :at)',
      { at },
    )
    .orderBy('"p"."approved_at" IS NOT NULL', 'DESC')
    .addOrderBy('"p"."unit_id" IS NULL', 'ASC')
    .addOrderBy('p.version', 'DESC')
    .getOne();
  if (!found)
    throw new Error(`no ${KIND} policy in force at ${at.toISOString()}`);
  return found;
}

/** Reporting currencies of the tenant's newest tenant-wide version (rates must be entered in one of them). */
export async function reportingCurrencies(
  manager: EntityManager,
  tenantId: string,
): Promise<string[]> {
  await ensureValuationPolicy(manager, tenantId);
  const newest = await manager.findOne(AccountingPolicy, {
    where: { tenantId, policyKind: KIND, scopeKey: 'tenant' },
    order: { version: 'DESC' },
  });
  return newest ? snapshotOf(newest).currencies : [];
}
