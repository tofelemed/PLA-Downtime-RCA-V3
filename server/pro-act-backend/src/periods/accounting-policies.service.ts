import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  CoverageGatePolicy,
  SourceAuthorityPolicy,
} from '../domain/actuals/period/period-actuals.types';
import { PolicyVersionRef } from './entities/actuals-run.entity';
import {
  AccountingPolicy,
  PolicyKind,
} from './entities/accounting-policy.entity';
import {
  COVERAGE_GATE_DEFAULT,
  parseCoverageGate,
  parseSourceAuthority,
  SOURCE_AUTHORITY_DEFAULT,
} from './policy-bodies';
import {
  OEE_POLICY_DEFAULT,
  OeePolicy,
  parseOeePolicy,
  parseReconciliationTolerance,
  RECONCILIATION_TOLERANCE_DEFAULT,
  ReconciliationTolerance,
} from './engine-policy-bodies';
import {
  LOSS_ACCOUNTING_DEFAULT,
  LossAccountingPolicy,
  parseLossAccounting,
} from './loss-accounting-policy';
import {
  parseRcaPolicy,
  RCA_POLICY_DEFAULT,
  RcaPolicy,
} from '../domain/rca/rca-policy';

const SEED_NOTE = 'Built-in default; change it by recording a new version.';

/**
 * Kinds seeded approved on first use; `valuation_basis` is seeded unapproved by the valuation module (VAL01);
 * the plant-wide workflow kinds by `WorkflowPoliciesService` (their default depends on the plant).
 */
type EngineKind = Exclude<
  PolicyKind,
  'valuation_basis' | 'month_close' | 'reconciliation_sla'
>;

const DEFAULT_BODIES: Readonly<Record<EngineKind, object>> = {
  coverage_gate: COVERAGE_GATE_DEFAULT,
  source_authority: SOURCE_AUTHORITY_DEFAULT,
  oee_policy: OEE_POLICY_DEFAULT,
  reconciliation_tolerance: RECONCILIATION_TOLERANCE_DEFAULT,
  rca_policy: RCA_POLICY_DEFAULT,
  loss_accounting: LOSS_ACCOUNTING_DEFAULT,
};

/** Policies of the accounting engine (plan 2.5): D04 OEE policy and D06 tolerance, with their versions. */
export interface EnginePolicies {
  oee: OeePolicy;
  tolerance: ReconciliationTolerance;
  lossAccounting: LossAccountingPolicy;
  refs: PolicyVersionRef[];
}

export interface ResolvedPolicies {
  coverageGate: CoverageGatePolicy;
  sourceAuthority: SourceAuthorityPolicy;
  refs: PolicyVersionRef[];
  sourceAuthorityId: string;
}

/**
 * Versioned accounting policies of plan 2.4 (0.2 design). Resolution: the highest version in force at the
 * instant for the unit, else for the tenant; a tenant without any version of a kind gets the D05 default
 * as version 1 on first use (the migration seeds existing tenants). Results record the versions used.
 */
/** Maker-checker kinds (source_authority, owner 15 Oct 2026): a draft or rejected version never resolves. */
const APPROVED_IF_DRAFTED =
  '(p.policyKind <> :draftedKind OR p.approvedAt IS NOT NULL)';

@Injectable()
export class AccountingPoliciesService {
  async resolve(
    manager: EntityManager,
    scope: { tenantId: string; unitId: string },
    at: Date,
  ): Promise<ResolvedPolicies> {
    const gate = await this.inForce(manager, scope, 'coverage_gate', at);
    const authority = await this.inForce(
      manager,
      scope,
      'source_authority',
      at,
    );
    return {
      coverageGate: parseCoverageGate(gate.body),
      sourceAuthority: parseSourceAuthority(authority.body),
      refs: [gate, authority].map((policy) => ({
        id: policy.id,
        kind: policy.policyKind,
        version: policy.version,
      })),
      sourceAuthorityId: authority.id,
    };
  }

  /** `oee_policy`, `reconciliation_tolerance` and `loss_accounting` in force for the unit at the instant (plan 2.5). */
  async resolveEngine(
    manager: EntityManager,
    scope: { tenantId: string; unitId: string },
    at: Date,
  ): Promise<EnginePolicies> {
    const oee = await this.inForce(manager, scope, 'oee_policy', at);
    const tolerance = await this.inForce(
      manager,
      scope,
      'reconciliation_tolerance',
      at,
    );
    const lossAccounting = await this.inForce(
      manager,
      scope,
      'loss_accounting',
      at,
    );
    return {
      oee: parseOeePolicy(oee.body),
      tolerance: parseReconciliationTolerance(tolerance.body),
      lossAccounting: parseLossAccounting(lossAccounting.body),
      refs: [oee, tolerance, lossAccounting].map((policy) => ({
        id: policy.id,
        kind: policy.policyKind,
        version: policy.version,
      })),
    };
  }

  /** `rca_policy` in force for the unit at the instant (plan 3.9, D13; seeded on first use). */
  async resolveRca(
    manager: EntityManager,
    scope: { tenantId: string; unitId: string },
    at: Date,
  ): Promise<{ policy: RcaPolicy; id: string; version: number }> {
    const found = await this.inForce(manager, scope, 'rca_policy', at);
    return {
      policy: parseRcaPolicy(found.body),
      id: found.id,
      version: found.version,
    };
  }

  /**
   * The `rca_policy` row in force at the instant (plan 3.9 API): the unit's own version, else the
   * tenant-wide one; `unitId: null` reads the tenant-wide version only. Seeded on first use.
   */
  rcaPolicyInForce(
    manager: EntityManager,
    scope: { tenantId: string; unitId: string | null },
    at: Date,
  ): Promise<AccountingPolicy> {
    return this.inForce(manager, scope, 'rca_policy', at);
  }

  /** The source_authority policy id in force for a unit (slice `actuals_policy_id`). */
  async sourceAuthorityId(
    manager: EntityManager,
    scope: { tenantId: string; unitId: string },
    at: Date,
  ): Promise<string> {
    return (await this.inForce(manager, scope, 'source_authority', at)).id;
  }

  private async inForce(
    manager: EntityManager,
    scope: { tenantId: string; unitId: string | null },
    kind: EngineKind,
    at: Date,
  ): Promise<AccountingPolicy> {
    const found = await this.find(manager, scope, kind, at);
    if (found) return found;
    await this.seedDefault(manager, scope.tenantId, kind);
    const seeded = await this.find(manager, scope, kind, at);
    if (!seeded)
      throw new Error(`no ${kind} policy in force at ${at.toISOString()}`);
    return seeded;
  }

  private find(
    manager: EntityManager,
    scope: { tenantId: string; unitId: string | null },
    kind: PolicyKind,
    at: Date,
  ): Promise<AccountingPolicy | null> {
    return manager
      .getRepository(AccountingPolicy)
      .createQueryBuilder('p')
      .where('p.tenantId = :tenantId AND p.policyKind = :kind', {
        tenantId: scope.tenantId,
        kind,
      })
      .andWhere('(p.unitId = :unitId OR p.unitId IS NULL)', {
        unitId: scope.unitId,
      })
      .andWhere(
        'p.effectiveFrom <= :at AND (p.effectiveTo IS NULL OR p.effectiveTo > :at)',
        { at },
      )
      .andWhere(APPROVED_IF_DRAFTED, { draftedKind: 'source_authority' })
      .orderBy('"p"."unit_id" IS NULL', 'ASC')
      .addOrderBy('p.version', 'DESC')
      .getOne();
  }

  /** Version 1 of the D04 / D05 / D06 default for a tenant that has none of this kind (idempotent). */
  private async seedDefault(
    manager: EntityManager,
    tenantId: string,
    kind: EngineKind,
  ): Promise<void> {
    const body = DEFAULT_BODIES[kind];
    await manager.query(
      `INSERT INTO "accounting_policies" ("tenant_id", "row_version", "policy_kind", "unit_id", "scope_key",
              "version", "body", "effective_from", "approved_at", "notes")
       SELECT $1, 1, $2::accounting_policy_kind, NULL, 'tenant', 1, $3::jsonb, '1970-01-01T00:00:00Z', now(), $4
        WHERE NOT EXISTS (SELECT 1 FROM "accounting_policies" WHERE "tenant_id" = $1 AND "policy_kind" = $2::accounting_policy_kind AND "unit_id" IS NULL)
       ON CONFLICT DO NOTHING`,
      [tenantId, kind, JSON.stringify(body), SEED_NOTE],
    );
  }
}
