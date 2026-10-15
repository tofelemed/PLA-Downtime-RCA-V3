import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AccountingRevision } from '../../accounting/entities/accounting-revision.entity';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { AccountingPoliciesService } from '../../periods/accounting-policies.service';
import { ProductionPeriod } from '../../periods/entities/production-period.entity';
import { notFound } from '../../profiles/profile-errors';
import { ApprovalAction } from '../../reconciliation/entities/approval-action.entity';
import { PeriodChangeProposal } from '../../reconciliation/entities/period-change-proposal.entity';
import {
  latestRevision,
  periodInScope,
  publishedRevision,
} from '../../reconciliation/revision-access';
import { loadRevisionState } from '../../reconciliation/revision-state';
import { toleranceJustification } from '../../uncertainty/tolerance-justification';
import { keysetPage } from '../common/keyset-page';
import { listResponse, ListResponse, ListScope } from '../common/response';
import {
  ReconciliationQueryDto,
  WorkflowListQueryDto,
} from './reconciliation-v2.dto';
import {
  ApprovalActionV2View,
  ChangeProposalV2View,
  ReconciliationV2View,
  toApprovalActionView,
  toProposalView,
  toReconciliationView,
} from './reconciliation-v2.view';

/**
 * v2 reads of plan 2.8: the reconciliation editor's view of a revision (current, published or numbered),
 * a period's approval history and its change proposals (keyset, newest first), one proposal. Tenant and
 * unit scope from identity; foreign or out-of-scope ids are 404. Reads never write.
 */
@Injectable()
export class ReconciliationV2Service {
  constructor(
    @InjectRepository(ProductionPeriod)
    private readonly periods: Repository<ProductionPeriod>,
    private readonly policies: AccountingPoliciesService,
  ) {}

  async view(
    context: RequestContext,
    periodId: string,
    query: ReconciliationQueryDto = {},
  ): Promise<ReconciliationV2View> {
    const manager = this.periods.manager;
    const period = await periodInScope(manager, context, periodId);
    const revision = await this.revisionOf(manager, period, query);
    return this.render(manager, period, revision);
  }

  /** The view of a known revision (command responses). */
  async viewOf(
    context: RequestContext,
    revision: AccountingRevision,
  ): Promise<ReconciliationV2View> {
    const manager = this.periods.manager;
    const period = await periodInScope(manager, context, revision.periodId);
    return this.render(manager, period, revision);
  }

  async approvalActions(
    context: RequestContext,
    periodId: string,
    query: WorkflowListQueryDto,
  ): Promise<ListResponse<ApprovalActionV2View>> {
    const manager = this.periods.manager;
    const period = await periodInScope(manager, context, periodId);
    const qb = scopedQuery(manager.getRepository(ApprovalAction), 'a', {
      context,
    }).andWhere('a.periodId = :periodId', { periodId: period.id });
    const page = await keysetPage(qb, {
      alias: 'a',
      property: 'createdAt',
      direction: 'DESC',
      cursor: query.cursor,
      limit: query.limit,
    });
    return listResponse(
      page.items.map(toApprovalActionView),
      page.nextCursor,
      this.scope(context, period),
    );
  }

  async proposals(
    context: RequestContext,
    periodId: string,
    query: WorkflowListQueryDto,
  ): Promise<ListResponse<ChangeProposalV2View>> {
    const manager = this.periods.manager;
    const period = await periodInScope(manager, context, periodId);
    const qb = scopedQuery(manager.getRepository(PeriodChangeProposal), 'cp', {
      context,
      unitProperty: 'unitId',
    }).andWhere('cp.periodId = :periodId', { periodId: period.id });
    const page = await keysetPage(qb, {
      alias: 'cp',
      property: 'createdAt',
      direction: 'DESC',
      cursor: query.cursor,
      limit: query.limit,
    });
    return listResponse(
      page.items.map(toProposalView),
      page.nextCursor,
      this.scope(context, period),
    );
  }

  async proposal(
    context: RequestContext,
    proposalId: string,
  ): Promise<ChangeProposalV2View> {
    const found = await scopedQuery(
      this.periods.manager.getRepository(PeriodChangeProposal),
      'cp',
      { context, unitProperty: 'unitId' },
    )
      .andWhere('cp.id = :proposalId', { proposalId })
      .getOne();
    if (!found) throw notFound('Change proposal');
    return toProposalView(found);
  }

  private async render(
    manager: EntityManager,
    period: ProductionPeriod,
    revision: AccountingRevision,
  ): Promise<ReconciliationV2View> {
    const state = await loadRevisionState(
      manager,
      period,
      revision,
      this.policies,
    );
    const published = await publishedRevision(manager, period.id);
    const open = published
      ? await manager.findOne(PeriodChangeProposal, {
          where: { approvedRevisionId: published.id, state: 'open' },
          select: { id: true },
        })
      : null;
    return toReconciliationView(state, {
      publishedRevision: published?.revision ?? null,
      openProposalId: open?.id ?? null,
      justification: await toleranceJustification(
        manager,
        period.tenantId,
        state.tolerance.body,
      ),
    });
  }

  private async revisionOf(
    manager: EntityManager,
    period: ProductionPeriod,
    query: ReconciliationQueryDto,
  ): Promise<AccountingRevision> {
    let found: AccountingRevision | null;
    if (query.revision !== undefined) {
      found = await manager.findOneBy(AccountingRevision, {
        periodId: period.id,
        revision: query.revision,
      });
    } else if (query.view === 'approved') {
      found = await publishedRevision(manager, period.id);
    } else {
      found = await latestRevision(manager, period.id);
    }
    if (!found) throw notFound('Accounting revision');
    return found;
  }

  private scope(context: RequestContext, period: ProductionPeriod): ListScope {
    return { tenantId: requireTenantId(context), unitIds: [period.unitId] };
  }
}
