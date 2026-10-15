import { ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AccountingRevision } from '../accounting/entities/accounting-revision.entity';
import { ActualsJobsService } from '../periods/actuals-jobs.service';
import { ProductionPeriod } from '../periods/entities/production-period.entity';
import { periodScopeUnits } from '../periods/period-scope';
import { RequestContext } from '../common/context/request-context';
import { appendAudit } from '../common/audit/audit-trail';
import { reopenCertifiedDay } from '../close/day-reopen';
import { correctionAllowed, CorrectionPath } from '../close/month-lock';
import { PeriodChangeProposal } from './entities/period-change-proposal.entity';
import { ReconciliationLine } from './entities/reconciliation-line.entity';
import { copyOf, LineSetWriter } from './line-set.writer';
import { latestRevision, publishedRevision } from './revision-access';
import { revisionMismatch } from './workflow-errors';
import {
  actorOf,
  publishWorkflowEvent,
  recordTransition,
  WORKFLOW_EVENTS,
} from './workflow-recorder';

export interface ReviseRequest {
  period: ProductionPeriod;
  approvedRevision: number;
  reason: string;
  /** SME R4: a locked month's periods change only through a change proposal (default `direct`) */
  via?: CorrectionPath;
}

export interface ReviseDeps {
  writer: LineSetWriter;
  jobs: ActualsJobsService;
}

/** The published approved revision named by number (409 when it is not the published one or one is open). */
async function revisable(
  manager: EntityManager,
  request: ReviseRequest,
): Promise<AccountingRevision> {
  const published = await publishedRevision(manager, request.period.id);
  if (!published || published.revision !== request.approvedRevision) {
    throw revisionMismatch('published', published?.revision ?? null);
  }
  const latest = await latestRevision(manager, request.period.id);
  if (latest && latest.lifecycle !== 'approved') {
    throw new ConflictException({
      code: 'REVISION_OPEN',
      message: `revision ${latest.revision} of the period is ${latest.lifecycle}; finish or cancel it first`,
    });
  }
  return published;
}

/** The approved revision's decisions and manual lines, as the new draft's first set (no tolerance lines). */
async function copyDecisions(
  manager: EntityManager,
  approved: AccountingRevision,
  draft: AccountingRevision,
  deps: { writer: LineSetWriter; actorId: string | null },
): Promise<string | null> {
  if (!approved.currentLineSetId || !approved.currentRunId) return null;
  const lines = await manager.find(ReconciliationLine, {
    where: { lineSetId: approved.currentLineSetId },
    order: { position: 'ASC' },
  });
  const kept = lines.filter((line) => line.action !== 'tolerance');
  if (kept.length === 0) return null;
  const set = await deps.writer.write(manager, {
    revision: draft,
    baseRunId: approved.currentRunId,
    origin: 'revise_copy',
    lines: kept.map(copyOf),
    actorId: deps.actorId,
  });
  return set.id;
}

/** An open proposal on the revised revision is resolved by this revise. */
async function resolveProposals(
  manager: EntityManager,
  approved: AccountingRevision,
  draft: AccountingRevision,
  context: RequestContext,
): Promise<void> {
  const open = await manager.findOneBy(PeriodChangeProposal, {
    approvedRevisionId: approved.id,
    state: 'open',
  });
  if (!open) return;
  await manager.update(PeriodChangeProposal, open.id, {
    state: 'accepted',
    resolvedBy: context.userId,
    resolvedAt: new Date(),
    resolutionReason: draft.comment,
    createdRevisionId: draft.id,
    updatedBy: context.userId,
  });
  await appendAudit(manager, [
    {
      tenantId: open.tenantId,
      actorId: context.userId,
      action: 'period_change_proposal.accepted',
      entityType: 'period_change_proposal',
      entityId: open.id,
      reason: draft.comment,
      correlationId: context.correlationId,
      detail: { from: 'open', to: 'accepted', createdRevisionId: draft.id },
    },
  ]);
}

/** A recalculation of the period for the new draft, under the requester's unit scope. */
async function queueRun(
  manager: EntityManager,
  context: RequestContext,
  period: ProductionPeriod,
  jobs: ActualsJobsService,
): Promise<void> {
  await jobs.enqueue(manager, {
    tenantId: period.tenantId,
    unitIds: [period.unitId],
    from: period.utcStart,
    to: period.utcEnd,
    trigger: 'revise',
    scopeUnitIds: periodScopeUnits(context),
    requestedBy: context.userId,
  });
}

/** Revision n + 1 of the period, a draft superseding the approved one. */
async function createDraft(
  manager: EntityManager,
  context: RequestContext,
  request: ReviseRequest & { afterClose: boolean },
  approved: AccountingRevision,
): Promise<AccountingRevision> {
  const { period } = request;
  const [{ next }] = await manager.query<Array<{ next: number }>>(
    `SELECT max("revision") + 1 AS "next" FROM "accounting_revisions" WHERE "period_id" = $1`,
    [period.id],
  );
  return manager.save(
    manager.create(AccountingRevision, {
      tenantId: period.tenantId,
      periodId: period.id,
      revision: next,
      lifecycle: 'draft',
      supersedesId: approved.id,
      afterClose: request.afterClose,
      inputHash: null,
      currentRunId: null,
      currentLineSetId: null,
      comment: request.reason,
      createdBy: context.userId,
    }),
  );
}

/**
 * Revise (WF01/WF04, plan 2.8 step 4): a new draft revision n + 1 that supersedes the published approved
 * one, carrying its decisions and manual lines; the approved revision stays published and untouched until
 * the new one is approved. A recalculation job (requester's unit scope) gives the draft its own run; an
 * open change proposal on the approved revision is resolved by it. Audited; outbox `PeriodRevisionOpened`.
 */
export async function reviseIn(
  manager: EntityManager,
  context: RequestContext,
  request: ReviseRequest,
  deps: ReviseDeps,
): Promise<AccountingRevision> {
  const { period } = request;
  const approved = await revisable(manager, request);
  const { afterClose } = await correctionAllowed(
    manager,
    period,
    request.via ?? 'direct',
  );
  const draft = await createDraft(
    manager,
    context,
    { ...request, afterClose },
    approved,
  );
  const setId = await copyDecisions(manager, approved, draft, {
    writer: deps.writer,
    actorId: context.userId,
  });
  if (setId) {
    await manager.update(AccountingRevision, draft.id, {
      currentLineSetId: setId,
    });
  }
  await recordTransition(manager, {
    revision: draft,
    action: 'revise',
    from: 'approved',
    to: 'draft',
    actor: actorOf(context),
    reason: request.reason,
    detail: {
      supersedesId: approved.id,
      supersedesRevision: approved.revision,
      ...(afterClose ? { afterClose } : {}),
    },
  });
  await resolveProposals(manager, approved, draft, context);
  await reopenCertifiedDay(manager, {
    period,
    actorId: context.userId,
    reason: request.reason,
    correlationId: context.correlationId || null,
  });
  await queueRun(manager, context, period, deps.jobs);
  await publishWorkflowEvent(manager, draft, WORKFLOW_EVENTS.revised, {
    supersedesId: approved.id,
    reason: request.reason,
  });
  return manager.findOneByOrFail(AccountingRevision, { id: draft.id });
}
