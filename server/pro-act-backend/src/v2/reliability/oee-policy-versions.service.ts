import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { AccountingPoliciesService } from '../../periods/accounting-policies.service';
import { OeePolicy, parseOeePolicy } from '../../periods/engine-policy-bodies';
import { AccountingPolicy } from '../../periods/entities/accounting-policy.entity';
import { assertBodyUnitsInScope } from '../../periods/period-scope';
import { PolicyBodyError } from '../../periods/policy-bodies';
import { BackdateRequest, parseBackdate } from '../../periods/policy-backdate';
import { effectiveFromOf } from '../../periods/policy-backdate.guard';
import { invalid, invalidReference } from '../../profiles/profile-errors';
import { assertTenantWideWriter } from '../../profiles/profile-scope';

const KIND = 'oee_policy';
/** No unit has this id: resolving with it reads the tenant-wide version only. */
const NO_UNIT = '00000000-0000-0000-0000-000000000000';

export interface PolicyInForce {
  row: AccountingPolicy;
  body: OeePolicy;
}

/**
 * Scope and note of a new version; `unitId` absent = the tenant-wide version. `effectiveFrom` (with
 * `backdateReason`) is the commissioning backdate (owner, 18 Oct 2026); absent = effective now.
 */
export interface PolicyVersionScope extends BackdateRequest {
  unitId?: string;
  notes?: string;
}

/**
 * `oee_policy` versions written over HTTP (SME D6 micro-stops, 2.5.6 transition allowance): the version in
 * force for a unit (its override, else tenant-wide) and a new approved version of a scope, effective now —
 * the previous open version of the same scope ends, every field the change does not touch is kept from the
 * version in force. Periods already calculated keep the version they used. A commissioning backdate takes
 * effect at its past instant instead, when no calculated period of the scope overlaps it.
 */
@Injectable()
export class OeePolicyVersionsService {
  constructor(
    @InjectEntityManager() private readonly manager: EntityManager,
    private readonly policies: AccountingPoliciesService,
  ) {}

  async current(
    context: RequestContext,
    unitId: string | undefined,
    manager: EntityManager = this.manager,
  ): Promise<PolicyInForce> {
    const tenantId = requireTenantId(context);
    if (unitId) await this.assertUnit(context, tenantId, unitId);
    const engine = await this.policies.resolveEngine(
      manager,
      { tenantId, unitId: unitId ?? NO_UNIT },
      new Date(),
    );
    const ref = engine.refs.find((r) => r.kind === KIND);
    const row = await manager.findOneByOrFail(AccountingPolicy, {
      id: ref?.id,
      tenantId,
    });
    return { row, body: engine.oee };
  }

  /** Version n+1 of the scope with `change` applied to the body in force (422 INVALID_POLICY when invalid). */
  async write(
    context: RequestContext,
    scope: PolicyVersionScope,
    change: (base: OeePolicy) => OeePolicy,
  ): Promise<PolicyInForce> {
    const tenantId = requireTenantId(context);
    if (!scope.unitId) assertTenantWideWriter(context, tenantId);
    const backdate = parseBackdate(scope, new Date());
    return this.manager.transaction(async (manager) => {
      const base = await this.current(context, scope.unitId, manager);
      const body = checked(change(base.body));
      const scopeKey = scope.unitId ?? 'tenant';
      const version = await nextVersion(manager, tenantId, scopeKey);
      const now = new Date();
      const from = await effectiveFromOf(
        manager,
        { tenantId, kind: KIND, scopeKey, unitId: scope.unitId ?? null },
        backdate,
        now,
      );
      await manager.query(
        `UPDATE "accounting_policies" SET "effective_to" = $4, "updated_by" = $5
          WHERE "tenant_id" = $1 AND "policy_kind" = $2 AND "scope_key" = $3
            AND "effective_to" IS NULL AND "effective_from" < $4`,
        [tenantId, KIND, scopeKey, from, context.userId],
      );
      const row = await manager.save(
        manager.create(AccountingPolicy, {
          tenantId,
          policyKind: KIND,
          unitId: scope.unitId ?? null,
          scopeKey,
          version,
          body: { ...body },
          effectiveFrom: from,
          effectiveTo: null,
          approvedBy: context.userId,
          approvedAt: now,
          notes: scope.notes?.trim() || null,
          requestedEffectiveFrom: backdate?.effectiveFrom ?? null,
          backdateReason: backdate?.reason ?? null,
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

/** The new body, checked by the parser the engine applies (422 INVALID_POLICY). */
function checked(body: OeePolicy): OeePolicy {
  try {
    return parseOeePolicy(body);
  } catch (error: unknown) {
    if (error instanceof PolicyBodyError) {
      throw invalid('INVALID_POLICY', error.message);
    }
    throw error;
  }
}

/** Next version of the scope under a per-scope transaction lock. */
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
