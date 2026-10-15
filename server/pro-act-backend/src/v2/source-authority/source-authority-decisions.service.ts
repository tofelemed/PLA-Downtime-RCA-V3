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
import { AccountingPolicy } from '../../periods/entities/accounting-policy.entity';
import {
  assertNotAuthor,
  invalidTransition,
  notFound,
} from '../../profiles/profile-errors';
import { assertTenantWideWriter } from '../../profiles/profile-scope';
import { keysetPage } from '../common/keyset-page';
import { listResponse, ListResponse } from '../common/response';
import { SourceAuthorityVersionListQueryDto } from './source-authority-v2.dto';
import { SOURCE_AUTHORITY_APPROVERS } from './source-authority-roles';
import {
  lockScope,
  SOURCE_AUTHORITY_KIND,
  SourceAuthorityV2Service,
} from './source-authority-v2.service';
import {
  SourceAuthorityVersionV2View,
  toSourceAuthorityVersionView,
  versionStateOf,
} from './source-authority-v2.view';

const WHAT = 'source authority version';

interface Decision {
  kind: 'approved' | 'rejected';
  reason?: string;
}

/**
 * Maker-checker of `source_authority` versions (owner, 15 Oct 2026): production accounting approves or
 * rejects a draft, never its author. Approval makes the draft the scope's version in force from now — the
 * open approved version of the scope ends there — and refuses a draft prepared from a version that is no
 * longer in force (409 STALE_DRAFT). Periods already calculated keep their version until recalculated.
 */
@Injectable()
export class SourceAuthorityDecisionsService {
  private readonly manager: EntityManager;

  constructor(
    @InjectRepository(AccountingPolicy)
    private readonly rows: Repository<AccountingPolicy>,
    private readonly versions: SourceAuthorityV2Service,
  ) {
    this.manager = rows.manager;
  }

  async list(
    context: RequestContext,
    query: SourceAuthorityVersionListQueryDto,
  ): Promise<ListResponse<SourceAuthorityVersionV2View>> {
    const qb = scopedQuery(this.rows, 'p', {
      context,
      unitProperty: 'unitId',
    }).andWhere('p.policyKind = :kind', { kind: SOURCE_AUTHORITY_KIND });
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
      page.items.map((row) => toSourceAuthorityVersionView(row, now)),
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
      {
        context,
        unitProperty: 'unitId',
      },
    )
      .andWhere('p.id = :id AND p.policyKind = :kind', {
        id,
        kind: SOURCE_AUTHORITY_KIND,
      })
      .getOne();
    if (!found) throw notFound('Source authority version');
    return found;
  }

  approve(
    context: RequestContext,
    id: string,
    reason?: string,
  ): Promise<AccountingPolicy> {
    const decision = { kind: 'approved' as const, reason };
    return this.decide(context, id, decision, async (manager, draft) => {
      const base = await this.versions.current(
        context,
        draft.unitId ?? undefined,
        manager,
      );
      if (base.row.id !== draft.basedOnId) throw staleDraft(base.row.version);
      const now = new Date();
      await manager.query(
        `UPDATE "accounting_policies" SET "effective_to" = $4, "updated_by" = $5
          WHERE "tenant_id" = $1 AND "policy_kind" = $2 AND "scope_key" = $3
            AND "approved_at" IS NOT NULL AND "effective_to" IS NULL AND "effective_from" < $4`,
        [
          draft.tenantId,
          SOURCE_AUTHORITY_KIND,
          draft.scopeKey,
          now,
          context.userId,
        ],
      );
      await manager.update(AccountingPolicy, draft.id, {
        effectiveFrom: now,
        approvedBy: context.userId,
        approvedAt: now,
        updatedBy: context.userId,
      });
    });
  }

  reject(
    context: RequestContext,
    id: string,
    reason: string,
  ): Promise<AccountingPolicy> {
    const decision = { kind: 'rejected' as const, reason };
    return this.decide(context, id, decision, async (manager, draft) => {
      await manager.update(AccountingPolicy, draft.id, {
        rejectedBy: context.userId,
        rejectedAt: new Date(),
        rejectionReason: reason.trim(),
        updatedBy: context.userId,
      });
    });
  }

  /** Scope, state and author checks under the scope lock, then the decision and its audit row. */
  private decide(
    context: RequestContext,
    id: string,
    decision: Decision,
    apply: (manager: EntityManager, draft: AccountingPolicy) => Promise<void>,
  ): Promise<AccountingPolicy> {
    const tenantId = requireTenantId(context);
    return this.manager.transaction(async (manager) => {
      const found = await this.get(context, id, manager);
      if (found.unitId) {
        await requireUnitRole(
          manager,
          context,
          found.unitId,
          SOURCE_AUTHORITY_APPROVERS,
        );
      } else {
        assertTenantWideWriter(context, tenantId);
        requireTenantRole(context, SOURCE_AUTHORITY_APPROVERS);
      }
      await lockScope(manager, tenantId, found.scopeKey);
      const draft = await manager.findOneByOrFail(AccountingPolicy, {
        id: found.id,
        tenantId,
      });
      const state = versionStateOf(draft);
      if (state !== 'proposed')
        throw invalidTransition(WHAT, state, decision.kind);
      assertNotAuthor(draft, context.userId, 'Source authority');
      await apply(manager, draft);
      await appendAudit(manager, [
        {
          tenantId,
          actorId: context.userId,
          action: `source_authority.${decision.kind}`,
          entityType: 'accounting_policy',
          entityId: draft.id,
          revision: draft.version,
          reason: decision.reason?.trim() || null,
          correlationId: context.correlationId || null,
          detail: { unitId: draft.unitId, scopeKey: draft.scopeKey },
        },
      ]);
      return manager.findOneByOrFail(AccountingPolicy, { id: draft.id });
    });
  }
}

function staleDraft(inForceVersion: number): ConflictException {
  return new ConflictException({
    code: 'STALE_DRAFT',
    message: `version ${inForceVersion} came into force after this draft was prepared; draft again from it`,
  });
}
