import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AccountingRevision } from '../accounting/entities/accounting-revision.entity';
import {
  AccountingRevisionHooks,
  InputsChange,
} from '../accounting/revision-hooks';
import { AccountingPoliciesService } from '../periods/accounting-policies.service';
import { ProductionPeriod } from '../periods/entities/production-period.entity';
import {
  afterOf,
  beforeOf,
  triggerOf,
  upsertProposal,
} from './proposal-writer';
import { approvedCauseCoding } from './proposal-coding';
import { loadRevisionState } from './revision-state';
import {
  publishWorkflowEvent,
  recordTransition,
  serviceActor,
  WORKFLOW_EVENTS,
} from './workflow-recorder';

const SERVICE = 'accounting-run';

/**
 * Late corrections (WF04, plan 2.8 step 5), called by the 2.5 run inside its transaction when the inputs
 * of a period differ from the run of its latest revision and that revision is not a draft (drafts are
 * simply recalculated, their decisions kept): an in-review revision is marked stale (approve then answers
 * 409 STALE_SUBMISSION, T34); an approved revision is never touched — its change proposal opens or is
 * refreshed with the approved figures and a preview from the new inputs (T35). Same hash → nothing.
 */
@Injectable()
export class WorkflowRevisionHooks extends AccountingRevisionHooks {
  constructor(private readonly policies: AccountingPoliciesService) {
    super();
  }

  async onInputsChanged(
    manager: EntityManager,
    revision: AccountingRevision,
    change: InputsChange,
  ): Promise<void> {
    if (revision.inputHash === change.inputHash) return;
    if (revision.lifecycle === 'in_review') {
      await this.markStale(manager, revision, change);
      return;
    }
    if (revision.lifecycle === 'approved') {
      await this.propose(manager, revision, change);
    }
  }

  private async markStale(
    manager: EntityManager,
    revision: AccountingRevision,
    change: InputsChange,
  ): Promise<void> {
    if (revision.isStale) return;
    const reason = `inputs changed after submission (${change.trigger.reason})`;
    await manager.update(AccountingRevision, revision.id, {
      isStale: true,
      staleReason: reason,
    });
    await recordTransition(manager, {
      revision,
      action: 'stale',
      from: 'in_review',
      to: 'in_review',
      actor: serviceActor(SERVICE),
      reason,
      submittedHash: revision.submittedHash,
      beforeHash: revision.inputHash,
      afterHash: change.inputHash,
    });
    await publishWorkflowEvent(manager, revision, WORKFLOW_EVENTS.stale, {
      reason,
    });
  }

  private async propose(
    manager: EntityManager,
    approved: AccountingRevision,
    change: InputsChange,
  ): Promise<void> {
    const period = await manager.findOneByOrFail(ProductionPeriod, {
      id: approved.periodId,
    });
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
        trigger: triggerOf(change.trigger.reason),
        inputHash: change.inputHash,
        before: beforeOf(state),
        after: afterOf(
          state,
          change.preview(),
          change.inputHash,
          await approvedCauseCoding(manager, state),
        ),
        detail: { reason: change.trigger.reason },
      },
      serviceActor(SERVICE),
    );
  }
}
