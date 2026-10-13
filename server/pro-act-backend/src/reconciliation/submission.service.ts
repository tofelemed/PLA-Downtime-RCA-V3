import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { AccountingRevision } from '../accounting/entities/accounting-revision.entity';
import { RequestContext } from '../common/context/request-context';
import { formatDec } from '../domain/actuals/decimal';
import {
  claimIssues,
  submissionIssues,
} from '../domain/reconciliation/submission-gates';
import {
  ToleranceAdjustment,
  toleranceAdjustments,
} from '../domain/reconciliation/tolerance';
import { AccountingPoliciesService } from '../periods/accounting-policies.service';
import { invalidTransition } from '../profiles/profile-errors';
import { copyOf, LineDraft, LineSetWriter } from './line-set.writer';
import {
  lockPeriod,
  periodInScope,
  requireUser,
  revisionNumbered,
} from './revision-access';
import {
  candidatesOf,
  decisionLinesOf,
  loadRevisionState,
  reconcileWith,
  RevisionState,
} from './revision-state';
import { contentHashOf } from './reviewed-content';
import { environmentIssues } from './submission-environment';
import { contentChanged, runChanged, workflowIssues } from './workflow-errors';
import {
  actorOf,
  publishWorkflowEvent,
  recordTransition,
  WORKFLOW_EVENTS,
} from './workflow-recorder';

export interface SubmitCommand {
  revision: number;
  runId: string;
  contentHash: string;
  comment?: string;
}

/**
 * Submission of a draft (WF02, ACC09/ACC10; plan 2.8 steps 3–4), in one transaction serialized with the
 * period's runs: the editor saw the current run and content (409 RUN_CHANGED / CONTENT_CHANGED), the
 * environment gates pass (run validated, nothing pending, actuals coverage, no source conflict, no open
 * review item), residuals within tolerance become labelled `tolerance_adjustment` lines in a new set, the
 * content gates pass (residual / over-accounting beyond tolerance, missing codes, changed baselines), and
 * the revision goes `in_review` with the sha256 of its reviewed content as submitted hash. Audited;
 * outbox `PeriodSubmitted`.
 */
@Injectable()
export class SubmissionService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly policies: AccountingPoliciesService,
    private readonly writer: LineSetWriter,
  ) {}

  submit(
    context: RequestContext,
    periodId: string,
    command: SubmitCommand,
  ): Promise<AccountingRevision> {
    const submitter = requireUser(context);
    return this.dataSource.transaction(async (manager) => {
      const period = await periodInScope(manager, context, periodId);
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
          'in_review',
        );
      }
      const state = await loadRevisionState(
        manager,
        period,
        revision,
        this.policies,
      );
      assertSeen(state, command);
      const blocking = await environmentIssues(manager, state, this.policies);
      if (blocking.length > 0) throw workflowIssues(blocking);
      const final = await this.withTolerance(manager, state, submitter);
      const issues = [
        ...submissionIssues(
          final.reconciliation,
          decisionLinesOf(final.lines),
          final.tolerance.rule,
        ),
        ...claimIssues(
          final.reconciliation,
          candidatesOf(final.candidateLines),
        ),
      ];
      if (issues.length > 0) throw workflowIssues(issues);
      return this.markSubmitted(manager, final, context, command);
    });
  }

  /** Re-derives the tolerance lines: old ones dropped, one per slice within tolerance added (T32). */
  private async withTolerance(
    manager: EntityManager,
    state: RevisionState,
    submitter: string,
  ): Promise<RevisionState> {
    const kept = state.lines.filter((line) => line.action !== 'tolerance');
    const adjustments = toleranceAdjustments(
      reconcileWith(state, decisionLinesOf(kept)),
      state.tolerance.rule,
    );
    if (adjustments.length === 0 && kept.length === state.lines.length) {
      return state;
    }
    const lines = [
      ...kept.map(copyOf),
      ...adjustments.map((a) => toleranceLine(state, a)),
    ];
    const set = await this.writer.write(manager, {
      revision: state.revision,
      baseRunId: state.run?.id ?? '',
      origin: 'submit_tolerance',
      lines,
      actorId: submitter,
    });
    const revision = { ...state.revision, currentLineSetId: set.id };
    return loadRevisionState(manager, state.period, revision, this.policies);
  }

  private async markSubmitted(
    manager: EntityManager,
    state: RevisionState,
    context: RequestContext,
    command: SubmitCommand,
  ): Promise<AccountingRevision> {
    const { revision } = state;
    const submittedHash = contentHashOf(state);
    await manager.update(AccountingRevision, revision.id, {
      lifecycle: 'in_review',
      currentLineSetId: revision.currentLineSetId,
      submittedBy: context.userId,
      submittedAt: new Date(),
      submittedHash,
      submittedRunId: state.run?.id ?? null,
      isStale: false,
      staleReason: null,
      comment: command.comment ?? null,
      updatedBy: context.userId,
    });
    await recordTransition(manager, {
      revision,
      action: 'submit',
      from: 'draft',
      to: 'in_review',
      actor: actorOf(context),
      reason: command.comment ?? null,
      submittedHash,
      beforeHash: command.contentHash,
      afterHash: submittedHash,
    });
    await publishWorkflowEvent(manager, revision, WORKFLOW_EVENTS.submitted, {
      submittedHash,
      calculationRunId: state.run?.id ?? null,
      submittedBy: context.userId,
    });
    return manager.findOneByOrFail(AccountingRevision, { id: revision.id });
  }
}

/** The labelled line closing a slice's residual within tolerance (written by the system, author null). */
function toleranceLine(
  state: RevisionState,
  adjustment: ToleranceAdjustment,
): LineDraft {
  const { body } = state.tolerance;
  return {
    action: 'tolerance',
    autoKey: null,
    sliceId: adjustment.sliceId,
    kind: 'tolerance_adjustment',
    quantity: formatDec(adjustment.quantity),
    uom:
      state.totals.find((t) => t.sliceId === adjustment.sliceId)?.uom ?? null,
    basis: 'measured',
    evidence: [],
    missingCode: false,
    missingEvent: false,
    reason: `tolerance adjustment (${body.mode} ${body.value})`,
    authorId: null,
  };
}

/** The editor must have seen the current run and content (no submission of a stale view). */
function assertSeen(state: RevisionState, command: SubmitCommand): void {
  if (state.run?.id !== command.runId) {
    throw runChanged({ currentRunId: state.run?.id ?? null });
  }
  const current = contentHashOf(state);
  if (current !== command.contentHash) throw contentChanged(current);
}
