import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import {
  assertCostCurrency,
  parseRcaPolicy,
  RcaPolicy,
  RcaPolicyError,
} from '../../domain/rca/rca-policy';
import { AccountingPoliciesService } from '../../periods/accounting-policies.service';
import { AccountingPolicy } from '../../periods/entities/accounting-policy.entity';
import { ProductionPeriod } from '../../periods/entities/production-period.entity';
import { assertBodyUnitsInScope } from '../../periods/period-scope';
import { invalid, invalidReference } from '../../profiles/profile-errors';
import { assertTenantWideWriter } from '../../profiles/profile-scope';
import { CursorCodec, invalidCursor } from '../common/cursor-codec';
import {
  RcaPolicyCreateDto,
  RcaPolicyListQueryDto,
} from './rca-policies-v2.dto';

const KIND = 'rca_policy';

/**
 * `rca_policy` versions over HTTP (plan 3.9, D13). Reads resolve like the trigger service does (the unit's
 * own version, else the tenant-wide one; the D13 default is seeded on first use by
 * AccountingPoliciesService). A new version is approved on creation by the manager approver who sends
 * it, effective now, and closes the previous open version of the same scope in the same transaction.
 */
@Injectable()
export class RcaPoliciesV2Service {
  constructor(
    // any repository registered in V2Module gives the connection's manager (as KpiReportsV2Service)
    @InjectRepository(ProductionPeriod)
    private readonly periods: Repository<ProductionPeriod>,
    private readonly policies: AccountingPoliciesService,
  ) {}

  private get manager(): EntityManager {
    return this.periods.manager;
  }

  async current(
    context: RequestContext,
    unitId: string | undefined,
  ): Promise<AccountingPolicy> {
    const tenantId = requireTenantId(context);
    if (unitId) await this.assertUnit(context, tenantId, unitId);
    return this.policies.rcaPolicyInForce(
      this.manager,
      { tenantId, unitId: unitId ?? null },
      new Date(),
    );
  }

  async list(
    context: RequestContext,
    query: RcaPolicyListQueryDto,
  ): Promise<{ items: AccountingPolicy[]; nextCursor: string | null }> {
    const tenantId = requireTenantId(context);
    if (query.unitId) await this.assertUnit(context, tenantId, query.unitId);
    // the tenant-wide D13 default exists before anyone lists versions
    await this.policies.rcaPolicyInForce(
      this.manager,
      { tenantId, unitId: null },
      new Date(),
    );
    const qb = scopedQuery(this.manager.getRepository(AccountingPolicy), 'p', {
      context,
    })
      .andWhere('p.policyKind = :kind', { kind: KIND })
      .andWhere(query.unitId ? 'p.unitId = :unitId' : 'p.unitId IS NULL', {
        unitId: query.unitId,
      });
    const rows = await afterCursor(qb, query.cursor)
      .orderBy('p.version', 'DESC')
      .addOrderBy('p.id', 'DESC')
      .take(query.limit + 1)
      .getMany();
    const items = rows.slice(0, query.limit);
    const last = items[items.length - 1];
    const nextCursor =
      rows.length > query.limit && last
        ? CursorCodec.encode({ sortValue: last.version, id: last.id })
        : null;
    return { items, nextCursor };
  }

  async create(
    context: RequestContext,
    dto: RcaPolicyCreateDto,
  ): Promise<AccountingPolicy> {
    const tenantId = requireTenantId(context);
    const unitId = dto.unitId ?? null;
    if (unitId) await this.assertUnit(context, tenantId, unitId);
    else assertTenantWideWriter(context, tenantId);
    return this.manager.transaction(async (manager) => {
      // the tenant-wide default is version 1 of its scope before the first change
      await this.policies.rcaPolicyInForce(
        manager,
        { tenantId, unitId: null },
        new Date(),
      );
      const inForce = await this.policies.rcaPolicyInForce(
        manager,
        { tenantId, unitId },
        new Date(),
      );
      const body = policyBody(dto, parseRcaPolicy(inForce.body));
      const scopeKey = unitId ?? 'tenant';
      const now = new Date();
      const version = await lockNextVersion(manager, tenantId, scopeKey);
      await closeOpenVersion(manager, { tenantId, scopeKey, now, context });
      return manager.save(
        manager.create(AccountingPolicy, {
          tenantId,
          policyKind: KIND,
          unitId,
          scopeKey,
          version,
          body: { ...body },
          effectiveFrom: now,
          effectiveTo: null,
          approvedBy: context.userId,
          approvedAt: now,
          notes: dto.notes?.trim() || null,
          createdBy: context.userId,
          updatedBy: context.userId,
        }),
      );
    });
  }

  /** A unit of the tenant and of the caller's scope, else 422 INVALID_REFERENCE (no existence leak). */
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

/** Keyset on `(version, id)` descending (CONVENTIONS §4); a cursor without a numeric version is 400. */
function afterCursor(
  qb: SelectQueryBuilder<AccountingPolicy>,
  cursor: string | undefined,
): SelectQueryBuilder<AccountingPolicy> {
  if (!cursor) return qb;
  const { sortValue, id } = CursorCodec.decode(cursor);
  if (typeof sortValue !== 'number') throw invalidCursor();
  return qb.andWhere(
    '(p.version < :cursorVersion OR (p.version = :cursorVersion AND p.id < :cursorId))',
    { cursorVersion: sortValue, cursorId: id },
  );
}

/**
 * The stored body, checked by the parser the trigger service applies (422 INVALID_POLICY). Options the
 * body leaves out keep the values of the version in force (a D13 screen sending the five trigger fields
 * does not switch D17 options off); a money limit names its currency.
 */
function policyBody(dto: RcaPolicyCreateDto, inForce: RcaPolicy): RcaPolicy {
  const defined = Object.fromEntries(
    Object.entries(dto).filter(
      ([key, value]) =>
        value !== undefined && key !== 'unitId' && key !== 'notes',
    ),
  );
  try {
    const policy = parseRcaPolicy({
      ...inForce,
      costThreshold: null,
      costCurrency: null,
      ...defined,
    });
    assertCostCurrency(policy);
    return policy;
  } catch (error: unknown) {
    if (error instanceof RcaPolicyError) {
      throw invalid('INVALID_POLICY', error.message);
    }
    throw error;
  }
}

/** Next version of the scope under a per-scope transaction lock (no version race between writers). */
async function lockNextVersion(
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

/** Ends the open version(s) of the scope at `now` (only those that started before it: CHK to > from). */
async function closeOpenVersion(
  manager: EntityManager,
  input: {
    tenantId: string;
    scopeKey: string;
    now: Date;
    context: RequestContext;
  },
): Promise<void> {
  await manager
    .createQueryBuilder()
    .update(AccountingPolicy)
    .set({ effectiveTo: input.now, updatedBy: input.context.userId })
    .where(
      'tenant_id = :tenantId AND policy_kind = :kind AND scope_key = :scopeKey',
      { tenantId: input.tenantId, kind: KIND, scopeKey: input.scopeKey },
    )
    .andWhere('effective_to IS NULL AND effective_from < :now', {
      now: input.now,
    })
    .execute();
}
