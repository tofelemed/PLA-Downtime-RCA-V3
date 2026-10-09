import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { AccountingRevision } from '../accounting/entities/accounting-revision.entity';
import { RequestContext } from '../common/context/request-context';
import { AccountingPoliciesService } from '../periods/accounting-policies.service';
import { ProductionPeriod } from '../periods/entities/production-period.entity';
import { invalidTransition } from '../profiles/profile-errors';
import { ApprovalSnapshot } from './entities/approval-snapshot.entity';
import {
  lockPeriod,
  periodInScope,
  requireUser,
  revisionNumbered,
} from './revision-access';
import { loadRevisionState, RevisionState } from './revision-state';
import { contentHashOf, reviewedContent, sha256 } from './reviewed-content';
import { separationOfDuties, staleSubmission } from './workflow-errors';
import {
  actorOf,
  publishWorkflowEvent,
  recordTransition,
  SUBMISSION_CLEARED,
  WORKFLOW_EVENTS,
} from './workflow-recorder';

export interface ApproveCommand {
  revision: number;
  submittedHash: string;
  comment?: string;
}

export interface RejectCommand {
  revision: number;
  reason: string;
}

/**
 * Approval and rejection of a submitted revision (WF01–WF03, D06; plan 2.8 step 4). Both need a manager
 * approver in scope who is not the submitter (403 SEPARATION_OF_DUTIES — also for SuperAdmin and for a
 * user holding both roles). Approval needs a revision that is in review, not stale, with the submitted
 * hash the approver saw and a reviewed content that still hashes to it (409 STALE_SUBMISSION); it stores
 * the approval snapshot, makes the revision `approved` (immutable from then on), labels the period
 * reconciled and queues `PeriodApproved` for delivery after commit. Rejection returns the revision to
 * draft with the reviewer's reason.
 */
@Injectable()
export class ApprovalService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly policies: AccountingPoliciesService,
  ) {}

  approve(
    context: RequestContext,
    periodId: string,
    command: ApproveCommand,
  ): Promise<AccountingRevision> {
    const approver = requireUser(context);
    return this.dataSource.transaction(async (manager) => {
      const { period, revision } = await this.submitted(
        manager,
        context,
        periodId,
        command.revision,
      );
      if (revision.submittedBy === approver) throw separationOfDuties();
      if (revision.isStale)
        throw staleSubmission(revision.staleReason ?? 'inputs changed');
      if (command.submittedHash !== revision.submittedHash)
        throw staleSubmission('the submitted hash differs');
      const state = await loadRevisionState(
        manager,
        period,
        revision,
        this.policies,
      );
      if (contentHashOf(state) !== revision.submittedHash)
        throw staleSubmission('the reviewed content changed');
      await markApproved(manager, state, context, command);
      return manager.findOneByOrFail(AccountingRevision, { id: revision.id });
    });
  }

  reject(
    context: RequestContext,
    periodId: string,
    command: RejectCommand,
  ): Promise<AccountingRevision> {
    const reviewer = requireUser(context);
    return this.dataSource.transaction(async (manager) => {
      const { revision } = await this.submitted(
        manager,
        context,
        periodId,
        command.revision,
      );
      if (revision.submittedBy === reviewer) throw separationOfDuties();
      await manager.update(AccountingRevision, revision.id, {
        lifecycle: 'draft',
        rejectedBy: reviewer,
        rejectedAt: new Date(),
        rejectReason: command.reason,
        ...SUBMISSION_CLEARED,
        comment: command.reason,
        updatedBy: reviewer,
      });
      await recordTransition(manager, {
        revision,
        action: 'reject',
        from: 'in_review',
        to: 'draft',
        actor: actorOf(context),
        reason: command.reason,
        submittedHash: revision.submittedHash,
      });
      await publishWorkflowEvent(manager, revision, WORKFLOW_EVENTS.rejected, {
        reason: command.reason,
        rejectedBy: reviewer,
      });
      return manager.findOneByOrFail(AccountingRevision, { id: revision.id });
    });
  }

  /** The numbered revision of a period in scope, locked and in review (409 otherwise). */
  private async submitted(
    manager: EntityManager,
    context: RequestContext,
    periodId: string,
    number: number,
  ): Promise<{ period: ProductionPeriod; revision: AccountingRevision }> {
    const period = await periodInScope(manager, context, periodId);
    await lockPeriod(manager, period.id);
    const revision = await revisionNumbered(manager, period.id, number);
    if (revision.lifecycle !== 'in_review') {
      throw invalidTransition(
        'accounting revision',
        revision.lifecycle,
        'decided',
      );
    }
    return { period, revision };
  }
}

/** Snapshot, `approved`, reconciled label, history and outbox `PeriodApproved` — one transaction. */
async function markApproved(
  manager: EntityManager,
  state: RevisionState,
  context: RequestContext,
  command: ApproveCommand,
): Promise<void> {
  const { period, revision } = state;
  const approver = context.userId as string;
  const snapshot = await storeSnapshot(manager, state, approver, command);
  await manager.update(AccountingRevision, revision.id, {
    lifecycle: 'approved',
    approvedBy: approver,
    approvedAt: snapshot.createdAt,
    approvalSnapshotId: snapshot.id,
    comment: command.comment ?? revision.comment,
    updatedBy: approver,
  });
  await manager.update(ProductionPeriod, period.id, {
    stateReadiness: 'reconciled',
  });
  await recordTransition(manager, {
    revision,
    action: 'approve',
    from: 'in_review',
    to: 'approved',
    actor: actorOf(context),
    reason: command.comment ?? null,
    submittedHash: revision.submittedHash,
    afterHash: snapshot.contentHash,
    detail: { snapshotId: snapshot.id },
  });
  await publishWorkflowEvent(manager, revision, WORKFLOW_EVENTS.approved, {
    unitId: period.unitId,
    submittedHash: revision.submittedHash,
    snapshotId: snapshot.id,
    calculationRunId: revision.currentRunId,
    supersedesId: revision.supersedesId,
    approvedBy: approver,
  });
}

/** WF03: the reviewed content plus who submitted and approved, when, and their comments. */
async function storeSnapshot(
  manager: EntityManager,
  state: RevisionState,
  approver: string,
  command: ApproveCommand,
): Promise<ApprovalSnapshot> {
  const { revision } = state;
  const approvedAt = new Date();
  const content = {
    reviewed: reviewedContent(state),
    submittedHash: revision.submittedHash,
    submittedBy: revision.submittedBy,
    submittedAt: revision.submittedAt?.toISOString() ?? null,
    submitComment: revision.comment,
    approvedBy: approver,
    approvedAt: approvedAt.toISOString(),
    approvalComment: command.comment ?? null,
  };
  return manager.save(
    manager.create(ApprovalSnapshot, {
      tenantId: revision.tenantId,
      revisionId: revision.id,
      periodId: revision.periodId,
      content,
      contentHash: sha256(content),
      submittedHash: revision.submittedHash as string,
      createdBy: approver,
      createdAt: approvedAt,
    }),
  );
}
