import { EntityManager } from 'typeorm';
import { AccountingRevision } from '../accounting/entities/accounting-revision.entity';
import { appendAudit } from '../common/audit/audit-trail';
import {
  LedgerTotals,
  PeriodAccounting,
} from '../domain/accounting/accounting.types';
import { reconcile } from '../domain/reconciliation/reconcile';
import { ProductionPeriod } from '../periods/entities/production-period.entity';
import {
  ChangeTrigger,
  PeriodChangeProposal,
} from './entities/period-change-proposal.entity';
import { decisionLinesOf, RevisionState } from './revision-state';
import { canon, ledgersPart, sliceView } from './reviewed-content';
import {
  Actor,
  publishWorkflowEvent,
  WORKFLOW_EVENTS,
} from './workflow-recorder';

const CANDIDATE_KINDS = new Set(['availability', 'performance', 'quality']);

/** Trigger of a proposal from the recalculation reason (2.4 / 2.5 trigger names). */
export function triggerOf(reason: string): ChangeTrigger {
  if (reason.endsWith('_retracted')) return 'source_retraction';
  if (reason.startsWith('loss_event')) return 'event_change';
  if (/output|adjustment|report/.test(reason)) return 'actuals_change';
  if (reason.includes('plan')) return 'plan_change';
  if (/rate|profile/.test(reason)) return 'rate_change';
  if (reason.includes('calendar')) return 'calendar_change';
  return 'recalculation';
}

/** The approved figures: run, both ledgers and the reconciled slices of the approved revision. */
export function beforeOf(state: RevisionState): Record<string, unknown> {
  return {
    revisionId: state.revision.id,
    revision: state.revision.revision,
    calculationRunId: state.run?.id ?? null,
    inputHash: state.revision.inputHash,
    ledgers: ledgersPart(state),
    slices: state.reconciliation.slices.map(sliceView),
  };
}

function ledgerView(t: LedgerTotals) {
  return {
    sliceId: t.sliceId,
    ledger: t.ledger,
    uom: t.uom,
    capacity: canon(t.capacity),
    exclusion: canon(t.exclusion),
    availability: canon(t.availability),
    performance: canon(t.performance),
    quality: canon(t.quality),
    good: canon(t.good),
    gain: canon(t.gain),
    attributed: canon(t.attributed),
    residual: canon(t.residual),
    target: canon(t.target),
    actual: canon(t.actual),
    gap: canon(t.gap),
    flags: t.flags,
  };
}

/**
 * The preview (never written as a run): both ledgers from the new inputs, and the approved decisions
 * re-applied to the new candidates so the reconciled residual before and after can be compared.
 */
export function afterOf(
  state: RevisionState,
  preview: PeriodAccounting,
  inputHash: string,
): Record<string, unknown> {
  const reconciliation = reconcile({
    candidates: preview.lines
      .filter((l) => l.ledger === 'plan' && CANDIDATE_KINDS.has(l.kind))
      .map((l) => ({
        autoKey: l.autoKey,
        sliceId: l.sliceId,
        kind: l.kind,
        quantity: l.quantity,
      })),
    lines: decisionLinesOf(state.lines),
    slices: preview.totals
      .filter((t) => t.ledger === 'plan')
      .map((t) => ({
        sliceId: t.sliceId,
        uom: t.uom,
        target: t.target,
        actual: t.actual,
        flags: t.flags,
      })),
    rule: state.tolerance.rule,
  });
  return {
    inputHash,
    issues: preview.issues,
    ledgers: preview.totals.map(ledgerView),
    slices: reconciliation.slices.map(sliceView),
  };
}

export interface ProposalDraft {
  period: ProductionPeriod;
  approved: AccountingRevision;
  trigger: ChangeTrigger;
  inputHash: string | null;
  before: Record<string, unknown>;
  after: Record<string, unknown> | null;
  detail: Record<string, unknown>;
}

/** The open proposal refreshed with the draft, or a new open proposal. */
function saveProposal(
  manager: EntityManager,
  open: PeriodChangeProposal | null,
  draft: ProposalDraft,
  actor: Actor,
): Promise<PeriodChangeProposal> {
  const values = {
    trigger: draft.trigger,
    inputHash: draft.inputHash,
    before: draft.before,
    after: draft.after,
    detail: draft.detail,
    updatedBy: actor.userId,
  };
  if (open) return manager.save(PeriodChangeProposal, { ...open, ...values });
  return manager.save(
    manager.create(PeriodChangeProposal, {
      ...values,
      tenantId: draft.period.tenantId,
      periodId: draft.period.id,
      unitId: draft.period.unitId,
      approvedRevisionId: draft.approved.id,
      state: 'open',
      affectedReports: [],
      createdBy: actor.userId,
    }),
  );
}

/**
 * Opens (or refreshes) the change proposal of an approved revision (WF04): one open proposal per approved
 * revision; a later change replaces its preview, trigger and hash. The approved revision and its snapshot
 * are never touched. Audited; outbox `PeriodChangeProposed`.
 */
export async function upsertProposal(
  manager: EntityManager,
  draft: ProposalDraft,
  actor: Actor,
): Promise<PeriodChangeProposal> {
  const open = await manager.findOneBy(PeriodChangeProposal, {
    approvedRevisionId: draft.approved.id,
    state: 'open',
  });
  if (open && open.inputHash !== null && open.inputHash === draft.inputHash) {
    return open;
  }
  const saved = await saveProposal(manager, open, draft, actor);
  await appendAudit(manager, [
    {
      tenantId: saved.tenantId,
      actorId: actor.userId,
      service: actor.service,
      action: `period_change_proposal.${open ? 'refreshed' : 'opened'}`,
      entityType: 'period_change_proposal',
      entityId: saved.id,
      revision: draft.approved.revision,
      afterHash: draft.inputHash,
      correlationId: actor.correlationId,
      detail: { trigger: draft.trigger, approvedRevisionId: draft.approved.id },
    },
  ]);
  await publishWorkflowEvent(
    manager,
    draft.approved,
    WORKFLOW_EVENTS.proposed,
    {
      proposalId: saved.id,
      trigger: draft.trigger,
    },
  );
  return saved;
}
