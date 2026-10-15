import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { requireUnitRole } from '../../auth/roles/require-unit-role';
import { requireTenantRole } from '../../auth/roles/require-tenant-role';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { SourceAuthorityPolicy } from '../../domain/actuals/period/period-actuals.types';
import { AccountingPoliciesService } from '../../periods/accounting-policies.service';
import { AccountingPolicy } from '../../periods/entities/accounting-policy.entity';
import { assertBodyUnitsInScope } from '../../periods/period-scope';
import {
  parseSourceAuthority,
  PolicyBodyError,
} from '../../periods/policy-bodies';
import { invalid, invalidReference } from '../../profiles/profile-errors';
import { assertTenantWideWriter } from '../../profiles/profile-scope';
import { MeasurementHierarchyDto } from './source-authority-v2.dto';
import { SOURCE_AUTHORITY_WRITERS } from './source-authority-roles';

export const SOURCE_AUTHORITY_KIND = 'source_authority';
/** No unit has this id: resolving with it reads the tenant-wide version only. */
const NO_UNIT = '00000000-0000-0000-0000-000000000000';

export interface SourceAuthorityInForce {
  row: AccountingPolicy;
  body: SourceAuthorityPolicy;
}

/**
 * `source_authority` versions over HTTP (SME E7 measurement hierarchy): the version in force for a unit
 * (its override, else tenant-wide) and a draft version of a scope — every other field is kept from the
 * version in force and the top rank becomes `primarySource`. The draft resolves nowhere until production
 * accounting approves it (`SourceAuthorityDecisionsService`, owner 15 Oct 2026: maker-checker).
 */
@Injectable()
export class SourceAuthorityV2Service {
  private readonly manager: EntityManager;

  constructor(
    @InjectRepository(AccountingPolicy) rows: Repository<AccountingPolicy>,
    private readonly policies: AccountingPoliciesService,
  ) {
    this.manager = rows.manager;
  }

  async current(
    context: RequestContext,
    unitId: string | undefined,
    manager: EntityManager = this.manager,
  ): Promise<SourceAuthorityInForce> {
    const tenantId = requireTenantId(context);
    if (unitId) await this.assertUnit(context, tenantId, unitId);
    const resolved = await this.policies.resolve(
      manager,
      { tenantId, unitId: unitId ?? NO_UNIT },
      new Date(),
    );
    const row = await manager.findOneByOrFail(AccountingPolicy, {
      id: resolved.sourceAuthorityId,
      tenantId,
    });
    return { row, body: resolved.sourceAuthority };
  }

  /** A draft version of the scope from the version in force; it applies only once approved. */
  async draft(
    context: RequestContext,
    change: {
      unitId?: string;
      measurementHierarchy: MeasurementHierarchyDto | null;
      notes?: string;
    },
  ): Promise<AccountingPolicy> {
    const tenantId = requireTenantId(context);
    if (!change.unitId) {
      assertTenantWideWriter(context, tenantId);
      requireTenantRole(context, SOURCE_AUTHORITY_WRITERS);
    }
    return this.manager.transaction(async (manager) => {
      const base = await this.current(context, change.unitId, manager);
      if (change.unitId)
        await requireUnitRole(
          manager,
          context,
          change.unitId,
          SOURCE_AUTHORITY_WRITERS,
        );
      const body = checked(
        withHierarchy(base.body, change.measurementHierarchy),
      );
      const scopeKey = change.unitId ?? 'tenant';
      const version = await lockedNextVersion(manager, tenantId, scopeKey);
      return manager.save(
        manager.create(AccountingPolicy, {
          tenantId,
          policyKind: SOURCE_AUTHORITY_KIND,
          unitId: change.unitId ?? null,
          scopeKey,
          version,
          body: { ...body },
          effectiveFrom: new Date(),
          effectiveTo: null,
          approvedBy: null,
          approvedAt: null,
          basedOnId: base.row.id,
          notes: change.notes?.trim() || null,
          createdBy: context.userId,
          updatedBy: context.userId,
        }),
      );
    });
  }

  /** 422 INVALID_REFERENCE unless the unit is the tenant's and in the caller's scope. */
  async assertUnit(
    context: RequestContext,
    tenantId: string,
    unitId: string,
  ): Promise<void> {
    assertBodyUnitsInScope(context, [unitId], 'unitId');
    const rows = await this.manager.query<unknown[]>(
      `SELECT 1 FROM "units" WHERE "id" = $1 AND "tenant_id" = $2`,
      [unitId, tenantId],
    );
    if (rows.length === 0) throw invalidReference('unitId', 'unit');
  }
}

/** The body in force with the new hierarchy (or none); the top rank is the primary source. */
function withHierarchy(
  base: SourceAuthorityPolicy,
  hierarchy: MeasurementHierarchyDto | null,
): Record<string, unknown> {
  const rest: Record<string, unknown> = { ...base };
  delete rest.measurementHierarchy;
  if (!hierarchy) return rest;
  const top = [...hierarchy.entries].sort((a, b) => a.rank - b.rank)[0];
  const primarySource = top?.source ?? base.primarySource;
  return {
    ...rest,
    primarySource,
    // the hierarchy replaces the fallback; one equal to the new primary would contradict SRC01
    fallback: base.fallback?.source === primarySource ? null : base.fallback,
    measurementHierarchy: {
      boundary: hierarchy.boundary,
      conditions: hierarchy.conditions,
      entries: hierarchy.entries.map((entry) => ({
        rank: entry.rank,
        sourceClass: entry.sourceClass,
        source: entry.source,
        signalSourceKey: entry.signalSourceKey ?? null,
        boundary: entry.boundary,
        boundaryAdjustment: entry.boundaryAdjustment ?? null,
      })),
    },
  };
}

/** The new body, checked by the parser the engine applies (422 INVALID_POLICY). */
function checked(body: Record<string, unknown>): SourceAuthorityPolicy {
  try {
    return parseSourceAuthority(body);
  } catch (error: unknown) {
    if (error instanceof PolicyBodyError) {
      throw invalid('INVALID_POLICY', error.message);
    }
    throw error;
  }
}

/** Serialises drafts and decisions of one scope (per-scope advisory lock, held to the transaction end). */
export async function lockScope(
  manager: EntityManager,
  tenantId: string,
  scopeKey: string,
): Promise<void> {
  await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
    `accounting_policies:${tenantId}:${SOURCE_AUTHORITY_KIND}:${scopeKey}`,
  ]);
}

async function lockedNextVersion(
  manager: EntityManager,
  tenantId: string,
  scopeKey: string,
): Promise<number> {
  await lockScope(manager, tenantId, scopeKey);
  const [{ next }] = await manager.query<Array<{ next: number }>>(
    `SELECT coalesce(max("version"), 0) + 1 AS "next" FROM "accounting_policies"
      WHERE "tenant_id" = $1 AND "policy_kind" = $2 AND "scope_key" = $3`,
    [tenantId, SOURCE_AUTHORITY_KIND, scopeKey],
  );
  return next;
}
