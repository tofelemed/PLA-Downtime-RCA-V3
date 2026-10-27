import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { requireUnitRole } from '../../auth/roles/require-unit-role';
import { requireTenantRole } from '../../auth/roles/require-tenant-role';
import { appendAudit } from '../../common/audit/audit-trail';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { parseLossAccounting } from '../../periods/loss-accounting-policy';
import { AccountingPolicy } from '../../periods/entities/accounting-policy.entity';
import { Backdate } from '../../periods/policy-backdate';
import { effectiveFromOf } from '../../periods/policy-backdate.guard';
import {
  assertNotAuthor,
  invalidTransition,
  notFound,
} from '../../profiles/profile-errors';
import { assertTenantWideWriter } from '../../profiles/profile-scope';
import { keysetPage } from '../common/keyset-page';
import { listResponse, ListResponse } from '../common/response';
import { versionStateOf } from '../source-authority/source-authority-v2.view';
import {
  DailyCalendarResult,
  LossAccountingCalendarService,
} from './loss-accounting-calendar.service';
import { LOSS_ACCOUNTING_APPROVERS } from './loss-accounting-roles';
import { LossAccountingVersionListQueryDto } from './loss-accounting-v2.dto';
import {
  LOSS_ACCOUNTING_KIND,
  LossAccountingV2Service,
  lockLossAccountingScope,
} from './loss-accounting-v2.service';
import {
  LossAccountingVersionV2View,
  toLossAccountingVersionView,
} from './loss-accounting-v2.view';

const WHAT = 'loss accounting version';

interface Decision {
  kind: 'approved' | 'rejected';
  reason?: string;
}

interface AppliedDetail {
  dailyCalendar?: DailyCalendarResult;
}

type Applied = (
  manager: EntityManager,
  draft: AccountingPolicy,
) => Promise<AppliedDetail>;

/** An approval and, for a day-grain version, what it did to the calendar. */
export interface LossAccountingApproval {
  row: AccountingPolicy;
  daily: DailyCalendarResult | null;
}

/**
 * Maker-checker of `loss_accounting` versions: another user approves or rejects a draft, never its author.
 * Approval makes the draft the scope's version in force from now (or its commissioning backdate) — the open
 * approved version of the scope ends there — and refuses a draft prepared from a version that is no longer
 * in force (409 STALE_DRAFT). A day-grain version also publishes the daily calendar and replaces the open
 * periods it covers (`LossAccountingCalendarService`), in the same step.
 */
@Injectable()
export class LossAccountingDecisionsService {
  private readonly manager: EntityManager;

  constructor(
    @InjectRepository(AccountingPolicy)
    private readonly rows: Repository<AccountingPolicy>,
    private readonly versions: LossAccountingV2Service,
    private readonly calendar: LossAccountingCalendarService,
  ) {
    this.manager = rows.manager;
  }

  async list(
    context: RequestContext,
    query: LossAccountingVersionListQueryDto,
  ): Promise<ListResponse<LossAccountingVersionV2View>> {
    const qb = scopedQuery(this.rows, 'p', {
      context,
      unitProperty: 'unitId',
    }).andWhere('p.policyKind = :kind', { kind: LOSS_ACCOUNTING_KIND });
    if (query.unitId && query.includeTenantWide)
      qb.andWhere('(p.unitId = :unitId OR p.unitId IS NULL)', query);
    else if (query.unitId) qb.andWhere('p.unitId = :unitId', query);
    else if (query.includeTenantWide) qb.andWhere('p.unitId IS NULL');
    if (query.state === 'proposed')
      qb.andWhere('p.approvedAt IS NULL AND p.rejectedAt IS NULL');
    if (query.state === 'approved') qb.andWhere('p.approvedAt IS NOT NULL');
    if (query.state === 'rejected') qb.andWhere('p.rejectedAt IS NOT NULL');
    const page = await keysetPage(qb, {
      alias: 'p',
      property: 'createdAt',
      direction: 'DESC',
      cursor: query.cursor,
      limit: query.limit,
    });
    const now = new Date();
    return listResponse(
      page.items.map((row) => toLossAccountingVersionView(row, now)),
      page.nextCursor,
      { tenantId: requireTenantId(context) },
    );
  }

  async get(
    context: RequestContext,
    id: string,
    manager: EntityManager = this.manager,
  ): Promise<AccountingPolicy> {
    const found = await scopedQuery(
      manager.getRepository(AccountingPolicy),
      'p',
      { context, unitProperty: 'unitId' },
    )
      .andWhere('p.id = :id AND p.policyKind = :kind', {
        id,
        kind: LOSS_ACCOUNTING_KIND,
      })
      .getOne();
    if (!found) throw notFound('Loss accounting version');
    return found;
  }

  async approve(
    context: RequestContext,
    id: string,
    reason?: string,
  ): Promise<LossAccountingApproval> {
    const decision = { kind: 'approved' as const, reason };
    const done = await this.decide(context, id, decision, (manager, draft) =>
      this.applyApproval(context, manager, draft),
    );
    return { row: done.row, daily: done.applied.dailyCalendar ?? null };
  }

  async reject(
    context: RequestContext,
    id: string,
    reason: string,
  ): Promise<AccountingPolicy> {
    const decision = { kind: 'rejected' as const, reason };
    const done = await this.decide(
      context,
      id,
      decision,
      async (manager, draft) => {
        await manager.update(AccountingPolicy, draft.id, {
          rejectedBy: context.userId,
          rejectedAt: new Date(),
          rejectionReason: reason.trim(),
          updatedBy: context.userId,
        });
        return {};
      },
    );
    return done.row;
  }

  private async applyApproval(
    context: RequestContext,
    manager: EntityManager,
    draft: AccountingPolicy,
  ): Promise<AppliedDetail> {
    const base = await this.versions.current(
      context,
      draft.unitId ?? undefined,
      manager,
    );
    if (base.row.id !== draft.basedOnId) throw staleDraft(base.row.version);
    const now = new Date();
    const from = await effectiveFromOf(
      manager,
      { ...scopeOf(draft), kind: LOSS_ACCOUNTING_KIND },
      requestedBackdate(draft),
      now,
    );
    const plan = await this.calendar.plan(manager, draft, from);
    await manager.query(
      `UPDATE "accounting_policies" SET "effective_to" = $4, "updated_by" = $5
        WHERE "tenant_id" = $1 AND "policy_kind" = $2 AND "scope_key" = $3
          AND "approved_at" IS NOT NULL AND "effective_to" IS NULL AND "effective_from" < $4`,
      [
        draft.tenantId,
        LOSS_ACCOUNTING_KIND,
        draft.scopeKey,
        from,
        context.userId,
      ],
    );
    await manager.update(AccountingPolicy, draft.id, {
      effectiveFrom: from,
      approvedBy: context.userId,
      approvedAt: now,
      updatedBy: context.userId,
    });
    if (!plan) return {};
    return {
      dailyCalendar: await this.calendar.apply(
        context,
        manager,
        plan,
        draft.version,
      ),
    };
  }

  /** Scope, state and author checks under the scope lock, then the decision and its audit row. */
  private decide(
    context: RequestContext,
    id: string,
    decision: Decision,
    apply: Applied,
  ): Promise<{ row: AccountingPolicy; applied: AppliedDetail }> {
    const tenantId = requireTenantId(context);
    return this.manager.transaction(async (manager) => {
      const found = await this.get(context, id, manager);
      if (found.unitId) {
        await requireUnitRole(
          manager,
          context,
          found.unitId,
          LOSS_ACCOUNTING_APPROVERS,
        );
      } else {
        assertTenantWideWriter(context, tenantId);
        requireTenantRole(context, LOSS_ACCOUNTING_APPROVERS);
      }
      const accounting = parseLossAccounting(found.body).accountingUnitId;
      if (accounting && accounting !== found.unitId) {
        await requireUnitRole(
          manager,
          context,
          accounting,
          LOSS_ACCOUNTING_APPROVERS,
        );
      }
      await lockLossAccountingScope(manager, tenantId, found.scopeKey);
      const draft = await manager.findOneByOrFail(AccountingPolicy, {
        id: found.id,
        tenantId,
      });
      const state = versionStateOf(draft);
      if (state !== 'proposed')
        throw invalidTransition(WHAT, state, decision.kind);
      assertNotAuthor(
        draft,
        context.userId,
        'Loss accounting',
        context.isSuperAdmin,
      );
      const applied = await apply(manager, draft);
      await appendAudit(manager, [
        {
          tenantId,
          actorId: context.userId,
          action: `loss_accounting.${decision.kind}`,
          entityType: 'accounting_policy',
          entityId: draft.id,
          revision: draft.version,
          reason: decision.reason?.trim() || null,
          correlationId: context.correlationId || null,
          detail: {
            unitId: draft.unitId,
            scopeKey: draft.scopeKey,
            requestedEffectiveFrom: draft.requestedEffectiveFrom
              ? new Date(draft.requestedEffectiveFrom).toISOString()
              : null,
            backdateReason: draft.backdateReason,
            ...applied,
          },
        },
      ]);
      const row = await manager.findOneByOrFail(AccountingPolicy, {
        id: draft.id,
      });
      return { row, applied };
    });
  }
}

const scopeOf = (draft: AccountingPolicy) => ({
  tenantId: draft.tenantId,
  scopeKey: draft.scopeKey,
  unitId: draft.unitId,
});

/** The commissioning backdate a draft carries, re-checked at approval. */
function requestedBackdate(draft: AccountingPolicy): Backdate | null {
  if (!draft.requestedEffectiveFrom) return null;
  return {
    effectiveFrom: new Date(draft.requestedEffectiveFrom),
    reason: draft.backdateReason ?? '',
  };
}

function staleDraft(inForceVersion: number): ConflictException {
  return new ConflictException({
    code: 'STALE_DRAFT',
    message: `version ${inForceVersion} came into force after this draft was prepared; draft again from it`,
  });
}
