import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { requireUnitRole } from '../../auth/roles/require-unit-role';
import { requireTenantRole } from '../../auth/roles/require-tenant-role';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { AccountingPoliciesService } from '../../periods/accounting-policies.service';
import { AccountingPolicy } from '../../periods/entities/accounting-policy.entity';
import {
  LossAccountingPolicy,
  parseLossAccounting,
} from '../../periods/loss-accounting-policy';
import { assertBodyUnitsInScope } from '../../periods/period-scope';
import { parseBackdate } from '../../periods/policy-backdate';
import { effectiveFromOf } from '../../periods/policy-backdate.guard';
import { PolicyBodyError } from '../../periods/policy-body-error';
import { invalid, invalidReference } from '../../profiles/profile-errors';
import { assertTenantWideWriter } from '../../profiles/profile-scope';
import { LOSS_ACCOUNTING_WRITERS } from './loss-accounting-roles';
import { LossAccountingVersionDto } from './loss-accounting-v2.dto';

export const LOSS_ACCOUNTING_KIND = 'loss_accounting';
/** No unit has this id: resolving with it reads the tenant-wide version only. */
const NO_UNIT = '00000000-0000-0000-0000-000000000000';

export interface LossAccountingInForce {
  row: AccountingPolicy;
  body: LossAccountingPolicy;
}

/**
 * `loss_accounting` versions over HTTP: the version in force for a unit (its override, else tenant-wide)
 * and a draft of a scope. Fields the draft omits are kept from the version in force. The draft resolves
 * nowhere until another user approves it (`LossAccountingDecisionsService`).
 */
@Injectable()
export class LossAccountingV2Service {
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
  ): Promise<LossAccountingInForce> {
    const tenantId = requireTenantId(context);
    if (unitId) await this.assertUnit(context, tenantId, unitId);
    const resolved = await this.policies.resolveEngine(
      manager,
      { tenantId, unitId: unitId ?? NO_UNIT },
      new Date(),
    );
    const ref = resolved.refs.find((r) => r.kind === LOSS_ACCOUNTING_KIND);
    const row = await manager.findOneByOrFail(AccountingPolicy, {
      id: ref?.id,
      tenantId,
    });
    return { row, body: resolved.lossAccounting };
  }

  /** A draft version of the scope from the version in force; it applies only once approved. */
  async draft(
    context: RequestContext,
    change: LossAccountingVersionDto,
  ): Promise<AccountingPolicy> {
    const tenantId = requireTenantId(context);
    if (!change.unitId) {
      assertTenantWideWriter(context, tenantId);
      requireTenantRole(context, LOSS_ACCOUNTING_WRITERS);
    }
    const backdate = parseBackdate(change, new Date());
    return this.manager.transaction(async (manager) => {
      const base = await this.current(context, change.unitId, manager);
      if (change.unitId) {
        await requireUnitRole(
          manager,
          context,
          change.unitId,
          LOSS_ACCOUNTING_WRITERS,
        );
      }
      if (change.accountingUnitId) {
        await this.assertUnit(context, tenantId, change.accountingUnitId);
        await requireUnitRole(
          manager,
          context,
          change.accountingUnitId,
          LOSS_ACCOUNTING_WRITERS,
        );
      }
      const body = checked({ ...base.body, ...policyFields(change) });
      const scopeKey = change.unitId ?? 'tenant';
      const version = await lockedNextVersion(manager, tenantId, scopeKey);
      await effectiveFromOf(
        manager,
        {
          tenantId,
          kind: LOSS_ACCOUNTING_KIND,
          scopeKey,
          unitId: change.unitId ?? null,
        },
        backdate,
        new Date(),
      );
      return manager.save(
        manager.create(AccountingPolicy, {
          tenantId,
          policyKind: LOSS_ACCOUNTING_KIND,
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
          requestedEffectiveFrom: backdate?.effectiveFrom ?? null,
          backdateReason: backdate?.reason ?? null,
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

/** The policy fields a draft names; an absent field is kept from the version in force. */
function policyFields(
  change: LossAccountingVersionDto,
): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    grain: change.grain,
    dayStart: change.dayStart,
    lossBasis: change.lossBasis,
    targetSource: change.targetSource,
    accountingUnitId: change.accountingUnitId,
    stopsCrossCheck: change.stopsCrossCheck,
    identityTolerance: change.identityTolerance,
  };
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  );
}

/** The new body, checked by the parser the engine applies (422 INVALID_POLICY). */
function checked(body: Record<string, unknown>): LossAccountingPolicy {
  try {
    return parseLossAccounting(body);
  } catch (error: unknown) {
    if (error instanceof PolicyBodyError) {
      throw invalid('INVALID_POLICY', error.message);
    }
    throw error;
  }
}

/** Serialises drafts and decisions of one scope (per-scope advisory lock, held to the transaction end). */
export async function lockLossAccountingScope(
  manager: EntityManager,
  tenantId: string,
  scopeKey: string,
): Promise<void> {
  await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
    `accounting_policies:${tenantId}:${LOSS_ACCOUNTING_KIND}:${scopeKey}`,
  ]);
}

async function lockedNextVersion(
  manager: EntityManager,
  tenantId: string,
  scopeKey: string,
): Promise<number> {
  await lockLossAccountingScope(manager, tenantId, scopeKey);
  const [{ next }] = await manager.query<Array<{ next: number }>>(
    `SELECT coalesce(max("version"), 0) + 1 AS "next" FROM "accounting_policies"
      WHERE "tenant_id" = $1 AND "policy_kind" = $2 AND "scope_key" = $3`,
    [tenantId, LOSS_ACCOUNTING_KIND, scopeKey],
  );
  return next;
}
