import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { AccountingRevision } from '../accounting/entities/accounting-revision.entity';
import { requireUnitRole } from '../auth/roles/require-unit-role';
import { appendAudit } from '../common/audit/audit-trail';
import { RequestContext } from '../common/context/request-context';
import { scopedQuery } from '../common/query/scoped-query';
import { AccountingPoliciesService } from '../periods/accounting-policies.service';
import { ActualsJobsService } from '../periods/actuals-jobs.service';
import {
  PeriodRestatementPort,
  RestatementRequest,
} from '../periods/period-restatement.port';
import { SliceResolverService } from '../periods/slice-resolver.service';
import { invalidTransition, notFound } from '../profiles/profile-errors';
import { REVISION_APPROVERS } from '../v2/periods/period-roles';
import { PeriodChangeProposal } from './entities/period-change-proposal.entity';
import { LineSetWriter } from './line-set.writer';
import {
  assertNotProposer,
  ManualProposalRequest,
  proposeCorrection,
} from './manual-proposal';
import { beforeOf, upsertProposal } from './proposal-writer';
import {
  lockPeriod,
  periodInScope,
  publishedRevision,
  requireUser,
} from './revision-access';
import { loadRevisionState } from './revision-state';
import { reviseIn } from './revise';
import { serviceActor } from './workflow-recorder';

export interface ProposalDecision {
  proposal: PeriodChangeProposal;
  revision: AccountingRevision | null;
}

/**
 * Change proposals of approved periods (WF04, plan 2.8 step 5): accepting one opens a revise draft over the
 * approved revision (for a plan restatement the period's slices are re-resolved from the new baseline
 * first), dismissing one records the reason; both are audited and need a manager approver in scope.
 * Registers the restatement handler of `PlanVersionApproved` (deferred by 2.3 / 2.4): every reconciled
 * period of the superseded baseline gets a `plan_change` proposal.
 */
@Injectable()
export class ChangeProposalsService implements OnModuleInit {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly policies: AccountingPoliciesService,
    private readonly writer: LineSetWriter,
    private readonly jobs: ActualsJobsService,
    private readonly slices: SliceResolverService,
    private readonly restatement: PeriodRestatementPort,
  ) {}

  onModuleInit(): void {
    this.restatement.register((manager, request) =>
      this.restate(manager, request),
    );
  }

  accept(
    context: RequestContext,
    proposalId: string,
    reason: string,
  ): Promise<ProposalDecision> {
    const actor = requireUser(context);
    return this.dataSource.transaction(async (manager) => {
      const proposal = await this.open(manager, context, proposalId);
      assertNotProposer(proposal, actor);
      const period = await periodInScope(manager, context, proposal.periodId);
      await lockPeriod(manager, period.id);
      const approved = await manager.findOneByOrFail(AccountingRevision, {
        id: proposal.approvedRevisionId,
      });
      if (proposal.trigger === 'plan_change') {
        await this.slices.resolve(manager, [period]);
      }
      const revision = await reviseIn(
        manager,
        context,
        {
          period,
          approvedRevision: approved.revision,
          reason,
          via: 'proposal',
        },
        { writer: this.writer, jobs: this.jobs },
      );
      const updated = await manager.findOneByOrFail(PeriodChangeProposal, {
        id: proposal.id,
      });
      return { proposal: updated, revision };
    });
  }

  /** A manual change proposal of a closing or locked month's approved period (SME R4). */
  propose(
    context: RequestContext,
    request: ManualProposalRequest,
  ): Promise<PeriodChangeProposal> {
    const userId = requireUser(context);
    return this.dataSource.transaction((manager) =>
      proposeCorrection(
        manager,
        { ...context, userId },
        request,
        this.policies,
      ),
    );
  }

  dismiss(
    context: RequestContext,
    proposalId: string,
    reason: string,
  ): Promise<ProposalDecision> {
    const actor = requireUser(context);
    return this.dataSource.transaction(async (manager) => {
      const proposal = await this.open(manager, context, proposalId);
      assertNotProposer(proposal, actor);
      await manager.update(PeriodChangeProposal, proposal.id, {
        state: 'dismissed',
        resolvedBy: actor,
        resolvedAt: new Date(),
        resolutionReason: reason,
        updatedBy: actor,
      });
      await appendAudit(manager, [
        {
          tenantId: proposal.tenantId,
          actorId: actor,
          action: 'period_change_proposal.dismissed',
          entityType: 'period_change_proposal',
          entityId: proposal.id,
          reason,
          correlationId: context.correlationId,
          detail: { from: 'open', to: 'dismissed' },
        },
      ]);
      const updated = await manager.findOneByOrFail(PeriodChangeProposal, {
        id: proposal.id,
      });
      return { proposal: updated, revision: null };
    });
  }

  /** An open proposal of the tenant and the caller's unit scope (404 otherwise), locked. */
  private async open(
    manager: EntityManager,
    context: RequestContext,
    proposalId: string,
  ): Promise<PeriodChangeProposal> {
    const proposal = await scopedQuery(
      manager.getRepository(PeriodChangeProposal),
      'cp',
      { context, unitProperty: 'unitId' },
    )
      .andWhere('cp.id = :proposalId', { proposalId })
      .setLock('pessimistic_write')
      .getOne();
    if (!proposal) throw notFound('Change proposal');
    await requireUnitRole(
      manager,
      context,
      proposal.unitId,
      REVISION_APPROVERS,
    );
    if (proposal.state !== 'open') {
      throw invalidTransition('change proposal', proposal.state, 'decided');
    }
    return proposal;
  }

  private async restate(
    manager: EntityManager,
    request: RestatementRequest,
  ): Promise<void> {
    for (const period of request.periods) {
      const approved = await publishedRevision(manager, period.id);
      if (!approved) continue;
      const state = await loadRevisionState(
        manager,
        period,
        approved,
        this.policies,
      );
      await upsertProposal(
        manager,
        {
          period,
          approved,
          trigger: 'plan_change',
          inputHash: null,
          before: beforeOf(state),
          after: null,
          detail: { planVersionId: request.planVersionId },
        },
        serviceActor('plan-restatement'),
      );
    }
  }
}
