import { ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AccountingRevision } from '../accounting/entities/accounting-revision.entity';
import { RequestContext } from '../common/context/request-context';
import { approvalConflict } from '../domain/reconciliation/separation-of-duties';
import { AccountingPoliciesService } from '../periods/accounting-policies.service';
import { invalidTransition } from '../profiles/profile-errors';
import { REVISION_APPROVERS } from '../v2/periods/period-roles';
import { bridgeReviewOf } from './bridge-review';
import { delegateDetail } from './delegate-detail';
import {
  lockPeriod,
  periodInScope,
  requireUser,
  revisionNumbered,
} from './revision-access';
import { loadRevisionState } from './revision-state';
import { contentHashOf } from './reviewed-content';
import { separationOfDuties, staleSubmission } from './workflow-errors';
import { actorOf, recordTransition } from './workflow-recorder';

export interface BridgeReviewCommand {
  revision: number;
  submittedHash: string;
  comment?: string;
}

/**
 * SME R8 second review of bridges above the unit limit: a revision approver who is independent of the
 * submission (not its submitter, not an author of its lines, not whoever reopened the period) confirms the
 * bridges of exactly the submitted content (hash), as an `approval_actions` step `bridge_review` (audited).
 * The final approver must be someone else. 409 BRIDGE_REVIEW_NOT_REQUIRED when no bridge is above the
 * limit, 409 BRIDGE_ALREADY_REVIEWED for a second review of the same submission.
 */
@Injectable()
export class BridgeReviewService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly policies: AccountingPoliciesService,
  ) {}

  review(
    context: RequestContext,
    periodId: string,
    command: BridgeReviewCommand,
  ): Promise<AccountingRevision> {
    const reviewer = requireUser(context);
    return this.dataSource.transaction(async (manager) => {
      const period = await periodInScope(
        manager,
        context,
        periodId,
        REVISION_APPROVERS,
      );
      await lockPeriod(manager, period.id);
      const revision = await revisionNumbered(
        manager,
        period.id,
        command.revision,
      );
      if (revision.lifecycle !== 'in_review') {
        throw invalidTransition(
          'accounting revision',
          revision.lifecycle,
          'bridge reviewed',
        );
      }
      if (
        revision.isStale ||
        command.submittedHash !== revision.submittedHash
      ) {
        throw staleSubmission(
          revision.staleReason ?? 'the submitted hash differs',
        );
      }
      const state = await loadRevisionState(
        manager,
        period,
        revision,
        this.policies,
      );
      if (contentHashOf(state) !== revision.submittedHash) {
        throw staleSubmission('the reviewed content changed');
      }
      const conflict = approvalConflict(reviewer, {
        submittedBy: revision.submittedBy,
        revisionOpenedBy: revision.supersedesId ? revision.createdBy : null,
        lineAuthors: state.lines.map((line) => line.authorId),
      });
      if (conflict) throw separationOfDuties();
      const current = await bridgeReviewOf(manager, state);
      if (!current.required)
        throw conflictOf(
          'BRIDGE_REVIEW_NOT_REQUIRED',
          'no bridge of this submission is above the unit limit',
        );
      if (current.review)
        throw conflictOf(
          'BRIDGE_ALREADY_REVIEWED',
          'the bridges of this submission are already reviewed',
        );
      await recordTransition(manager, {
        revision,
        action: 'bridge_review',
        from: 'in_review',
        to: 'in_review',
        actor: actorOf(context),
        reason: command.comment ?? null,
        submittedHash: revision.submittedHash,
        detail: {
          findings: current.findings,
          ...(await delegateDetail(manager, context, period.unitId)),
        },
      });
      return manager.findOneByOrFail(AccountingRevision, { id: revision.id });
    });
  }
}

function conflictOf(code: string, message: string): ConflictException {
  return new ConflictException({ code, message });
}
