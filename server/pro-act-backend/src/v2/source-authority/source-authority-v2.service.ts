import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
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

const KIND = 'source_authority';
/** No unit has this id: resolving with it reads the tenant-wide version only. */
const NO_UNIT = '00000000-0000-0000-0000-000000000000';

export interface SourceAuthorityInForce {
  row: AccountingPolicy;
  body: SourceAuthorityPolicy;
}

/**
 * `source_authority` versions over HTTP (SME E7 measurement hierarchy): the version in force for a unit
 * (its override, else tenant-wide) and a new approved version of a scope, effective now — the previous
 * open version of the scope ends, every other field is kept from the version in force, and the top rank
 * becomes `primarySource`. Periods already calculated keep the version they used until recalculated.
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

  async write(
    context: RequestContext,
    change: {
      unitId?: string;
      measurementHierarchy: MeasurementHierarchyDto | null;
      notes?: string;
    },
  ): Promise<SourceAuthorityInForce> {
    const tenantId = requireTenantId(context);
    if (!change.unitId) assertTenantWideWriter(context, tenantId);
    return this.manager.transaction(async (manager) => {
      const base = await this.current(context, change.unitId, manager);
      const body = checked(
        withHierarchy(base.body, change.measurementHierarchy),
      );
      const scopeKey = change.unitId ?? 'tenant';
      const now = new Date();
      const version = await nextVersion(manager, tenantId, scopeKey);
      await manager.query(
        `UPDATE "accounting_policies" SET "effective_to" = $4, "updated_by" = $5
          WHERE "tenant_id" = $1 AND "policy_kind" = $2 AND "scope_key" = $3
            AND "effective_to" IS NULL AND "effective_from" < $4`,
        [tenantId, KIND, scopeKey, now, context.userId],
      );
      const row = await manager.save(
        manager.create(AccountingPolicy, {
          tenantId,
          policyKind: KIND,
          unitId: change.unitId ?? null,
          scopeKey,
          version,
          body: { ...body },
          effectiveFrom: now,
          effectiveTo: null,
          approvedBy: context.userId,
          approvedAt: now,
          notes: change.notes?.trim() || null,
          createdBy: context.userId,
          updatedBy: context.userId,
        }),
      );
      return { row, body };
    });
  }

  private async assertUnit(
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

async function nextVersion(
  manager: EntityManager,
  tenantId: string,
  scopeKey: string,
): Promise<number> {
  await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
    `accounting_policies:${tenantId}:${KIND}:${scopeKey}`,
  ]);
  const [{ next }] = await manager.query<Array<{ next: number }>>(
    `SELECT coalesce(max("version"), 0) + 1 AS "next" FROM "accounting_policies"
      WHERE "tenant_id" = $1 AND "policy_kind" = $2 AND "scope_key" = $3`,
    [tenantId, KIND, scopeKey],
  );
  return next;
}
