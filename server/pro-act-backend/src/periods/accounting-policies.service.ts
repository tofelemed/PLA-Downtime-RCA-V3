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

const SEED_NOTE =
  'Seeded on first use from the D05 default (DECISIONS.md, 2026-10-07); change by a new version.';

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
    scope: { tenantId: string; unitId: string },
    kind: PolicyKind,
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
    scope: { tenantId: string; unitId: string },
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
      .orderBy('"p"."unit_id" IS NULL', 'ASC')
      .addOrderBy('p.version', 'DESC')
      .getOne();
  }

  /** Version 1 of the D05 default for a tenant that has none of this kind (idempotent). */
  private async seedDefault(
    manager: EntityManager,
    tenantId: string,
    kind: PolicyKind,
  ): Promise<void> {
    const body =
      kind === 'coverage_gate'
        ? COVERAGE_GATE_DEFAULT
        : SOURCE_AUTHORITY_DEFAULT;
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
