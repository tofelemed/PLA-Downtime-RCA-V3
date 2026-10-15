import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { AccountingRevision } from '../accounting/entities/accounting-revision.entity';
import { RequestContext } from '../common/context/request-context';
import { ActualsJobsService } from '../periods/actuals-jobs.service';
import { invalidTransition } from '../profiles/profile-errors';
import { PERIOD_WRITERS, REVISION_APPROVERS } from '../v2/periods/period-roles';
import { LineSetWriter } from './line-set.writer';
import {
  latestRevision,
  lockPeriod,
  periodInScope,
  requireUser,
  revisionNumbered,
} from './revision-access';
import { reviseIn } from './revise';
import {
  actorOf,
  publishWorkflowEvent,
  recordTransition,
  SUBMISSION_CLEARED,
  WORKFLOW_EVENTS,
} from './workflow-recorder';

/**
 * Revise, cancel and the workflow side of recompute (WF01/WF04; plan 2.8 step 4). Revise opens a new draft
 * over the published approved revision; cancel ends a draft (auditable, the published revision stays);
 * a recompute request returns a stale in-review revision to draft so the next run recalculates it
 * (T34: recompute + resubmit), and records the request on the revision's history.
 */
@Injectable()
export class RevisionLifecycleService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly writer: LineSetWriter,
    private readonly jobs: ActualsJobsService,
  ) {}

  revise(
    context: RequestContext,
    periodId: string,
    command: { approvedRevision: number; reason: string },
  ): Promise<AccountingRevision> {
    requireUser(context);
    return this.dataSource.transaction(async (manager) => {
      const period = await periodInScope(
        manager,
        context,
        periodId,
        REVISION_APPROVERS,
      );
      await lockPeriod(manager, period.id);
      return reviseIn(
        manager,
        context,
        { period, ...command },
        { writer: this.writer, jobs: this.jobs },
      );
    });
  }

  cancel(
    context: RequestContext,
    periodId: string,
    command: { revision: number; reason: string },
  ): Promise<AccountingRevision> {
    requireUser(context);
    return this.dataSource.transaction(async (manager) => {
      const period = await periodInScope(
        manager,
        context,
        periodId,
        PERIOD_WRITERS,
      );
      await lockPeriod(manager, period.id);
      const revision = await revisionNumbered(
        manager,
        period.id,
        command.revision,
      );
      if (revision.lifecycle !== 'draft') {
        throw invalidTransition(
          'accounting revision',
          revision.lifecycle,
          'cancelled',
        );
      }
      await markCancelled(manager, context, revision, command.reason);
      return manager.findOneByOrFail(AccountingRevision, { id: revision.id });
    });
  }

  /** Before a recompute job is queued: a stale submission goes back to draft; the request is recorded. */
  prepareRecompute(
    context: RequestContext,
    periodId: string,
    reason: string | null,
  ): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      const period = await periodInScope(
        manager,
        context,
        periodId,
        PERIOD_WRITERS,
      );
      await lockPeriod(manager, period.id);
      const revision = await latestRevision(manager, period.id);
      if (!revision || revision.lifecycle === 'approved') return;
      const reopen = revision.lifecycle === 'in_review' && revision.isStale;
      if (reopen) {
        await manager.update(AccountingRevision, revision.id, {
          lifecycle: 'draft',
          ...SUBMISSION_CLEARED,
          updatedBy: context.userId,
        });
      }
      await recordTransition(manager, {
        revision,
        action: 'recompute',
        from: revision.lifecycle,
        to: reopen ? 'draft' : revision.lifecycle,
        actor: actorOf(context),
        reason: reason ?? (reopen ? revision.staleReason : null),
      });
    });
  }
}

async function markCancelled(
  manager: EntityManager,
  context: RequestContext,
  revision: AccountingRevision,
  reason: string,
): Promise<void> {
  await manager.update(AccountingRevision, revision.id, {
    lifecycle: 'cancelled',
    cancelledBy: context.userId,
    cancelledAt: new Date(),
    comment: reason,
    updatedBy: context.userId,
  });
  await recordTransition(manager, {
    revision,
    action: 'cancel',
    from: 'draft',
    to: 'cancelled',
    actor: actorOf(context),
    reason,
  });
  await publishWorkflowEvent(manager, revision, WORKFLOW_EVENTS.cancelled, {
    reason,
  });
}
