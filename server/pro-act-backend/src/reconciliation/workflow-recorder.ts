import { EntityManager } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { AccountingRevision } from '../accounting/entities/accounting-revision.entity';
import { appendAudit, AuditDraft } from '../common/audit/audit-trail';
import { RequestContext } from '../common/context/request-context';
import { domainEnvelope } from '../common/domain-events/domain-event-envelope';
import { enqueueOutbox } from '../common/outbox/outbox-writer';
import {
  ApprovalAction,
  ApprovalActionKind,
} from './entities/approval-action.entity';

/** Who acted: a user of the request, or a named service (stale marking, restatement). */
export interface Actor {
  userId: string | null;
  service: string | null;
  correlationId: string | null;
}

export function actorOf(context: RequestContext): Actor {
  return {
    userId: context.userId,
    service: null,
    correlationId: context.correlationId || null,
  };
}

export function serviceActor(service: string): Actor {
  return { userId: null, service, correlationId: null };
}

export interface Transition {
  revision: AccountingRevision;
  action: ApprovalActionKind;
  from: string;
  to: string;
  actor: Actor;
  reason?: string | null;
  submittedHash?: string | null;
  beforeHash?: string | null;
  afterHash?: string | null;
  detail?: Record<string, unknown>;
}

function auditOf(step: Transition): AuditDraft {
  const { revision, actor } = step;
  return {
    tenantId: revision.tenantId,
    actorId: actor.userId,
    service: actor.service,
    action: `accounting_revision.${step.action}`,
    entityType: 'accounting_revision',
    entityId: revision.id,
    revision: revision.revision,
    beforeHash: step.beforeHash ?? null,
    afterHash: step.afterHash ?? null,
    reason: step.reason ?? null,
    correlationId: actor.correlationId,
    detail: {
      periodId: revision.periodId,
      from: step.from,
      to: step.to,
      ...(step.detail ?? {}),
    },
  };
}

/**
 * Records one workflow step (WF01/WF02): an `approval_actions` row and an `audit_log` row (who, when,
 * from, to, reason, hashes, correlation id), in the command's transaction.
 */
export async function recordTransition(
  manager: EntityManager,
  step: Transition,
): Promise<void> {
  const { revision, actor } = step;
  await manager.insert(ApprovalAction, {
    tenantId: revision.tenantId,
    revisionId: revision.id,
    periodId: revision.periodId,
    action: step.action,
    fromLifecycle: step.from,
    toLifecycle: step.to,
    actorId: actor.userId,
    service: actor.service,
    reason: step.reason ?? null,
    submittedHash: step.submittedHash ?? null,
    correlationId: actor.correlationId,
    // jsonb column: TypeORM's deep-partial type cannot express an open record
    detail: (step.detail ?? {}) as QueryDeepPartialEntity<
      Record<string, unknown>
    >,
    createdBy: actor.userId,
  });
  await appendAudit(manager, [auditOf(step)]);
}

/**
 * Outbox message of a workflow step with the v1 domain-message envelope (§15.4, plan 2.9); consumers run
 * after commit and cannot undo it (WF03). Types with a contract are schema-checked by the relay.
 */
export async function publishWorkflowEvent(
  manager: EntityManager,
  revision: AccountingRevision,
  type: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await enqueueOutbox(manager, [
    {
      tenantId: revision.tenantId,
      aggregateType: 'production_period',
      aggregateId: revision.periodId,
      type,
      version: revision.revision,
      payload: {
        ...domainEnvelope({
          tenantId: revision.tenantId,
          entityType: 'production_period',
          entityId: revision.periodId,
          entityRevision: revision.revision,
        }),
        periodId: revision.periodId,
        revisionId: revision.id,
        revision: revision.revision,
        ...payload,
      },
    },
  ]);
}

/** Message types of plan 2.8 (`PeriodRestated` and the versioned contracts: plan 2.9). */
export const WORKFLOW_EVENTS = {
  submitted: 'PeriodSubmitted',
  approved: 'PeriodApproved',
  restated: 'PeriodRestated',
  rejected: 'PeriodRejected',
  revised: 'PeriodRevisionOpened',
  cancelled: 'PeriodRevisionCancelled',
  stale: 'PeriodSubmissionStale',
  proposed: 'PeriodChangeProposed',
} as const;

/** Revision columns reset when a submission goes back to draft (reject, recompute of a stale one). */
export const SUBMISSION_CLEARED = {
  submittedBy: null,
  submittedAt: null,
  submittedHash: null,
  submittedRunId: null,
  isStale: false,
  staleReason: null,
} as const;
