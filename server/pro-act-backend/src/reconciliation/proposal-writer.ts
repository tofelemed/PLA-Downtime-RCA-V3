import { EntityManager } from 'typeorm';
import { AccountingRevision } from '../accounting/entities/accounting-revision.entity';
import { appendAudit } from '../common/audit/audit-trail';
import {
  LedgerTotals,
  PeriodAccounting,
} from '../domain/accounting/accounting.types';
import { ZERO } from '../domain/actuals/decimal';
import { sumOf } from '../domain/accounting/claims';
import { reconcile } from '../domain/reconciliation/reconcile';
import { SliceBasis } from '../domain/reconciliation/reconciliation.types';
import { ProductionPeriod } from '../periods/entities/production-period.entity';
import {
  AffectedReport,
  ChangeTrigger,
  PeriodChangeProposal,
} from './entities/period-change-proposal.entity';
import { CauseCoding, codingChangesOf } from './proposal-coding';
import { approvedValuesPart } from './proposal-values';
import { decisionLinesOf, RevisionState } from './revision-state';
import { canon, ledgersPart, sliceView } from './reviewed-content';
import {
  Actor,
  publishWorkflowEvent,
  WORKFLOW_EVENTS,
} from './workflow-recorder';

const CANDIDATE_KINDS = new Set(['availability', 'performance', 'quality']);

/** Reasons of a valuation input change (`baseline-recalc.consumer.ts` `recalcTriggerOf`). */
const VALUATION_REASONS = /^(fx_rate|valuation_policy|demand_status)_changed$/;

/** Trigger of a proposal from the recalculation reason (2.4 / 2.5 trigger names). */
export function triggerOf(reason: string): ChangeTrigger {
  if (reason.endsWith('_retracted')) return 'source_retraction';
  if (reason.startsWith('loss_event')) return 'event_change';
  if (/output|adjustment|report/.test(reason)) return 'actuals_change';
  if (VALUATION_REASONS.test(reason)) return 'valuation_change';
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
    ...approvedValuesPart(state),
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
 * The plan slices of a preview; Task 13 fix 1: its declared recovery shares (`gain` lines, basis declared,
 * negative) are carried as the positive `declaredGain` the reconciliation takes off the attributed loss.
 */
function previewSlices(preview: PeriodAccounting): SliceBasis[] {
  return preview.totals
    .filter((t) => t.ledger === 'plan')
    .map((t) => {
      const recovery = preview.lines.filter(
        (l) =>
          l.ledger === 'plan' &&
          l.kind === 'gain' &&
          l.basis === 'declared' &&
          l.sliceId === t.sliceId,
      );
      return {
        sliceId: t.sliceId,
        uom: t.uom,
        target: t.target,
        actual: t.actual,
        flags: t.flags,
        ...(recovery.length > 0
          ? { declaredGain: ZERO.minus(sumOf(recovery.map((l) => l.quantity))) }
          : {}),
      };
    });
}

/**
 * The preview (never written as a run): both ledgers from the new inputs, and the approved decisions
 * re-applied to the new candidates so the reconciled residual before and after can be compared.
 */
export function afterOf(
  state: RevisionState,
  preview: PeriodAccounting,
  inputHash: string,
  causeCoding?: ReadonlyMap<string, CauseCoding>,
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
    slices: previewSlices(preview),
    rule: state.tolerance.rule,
  });
  return {
    inputHash,
    issues: preview.issues,
    ledgers: preview.totals.map(ledgerView),
    slices: reconciliation.slices.map(sliceView),
    codingChanges: codingChangesOf(state, preview, causeCoding),
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

/**
 * Completed exports that contain the approved revision (plan 2.9): the reports a restatement would make
 * stale. Capped; the export ids lead to their sources.
 */
async function affectedReportsOf(
  manager: EntityManager,
  revisionId: string,
): Promise<AffectedReport[]> {
  const rows: Array<{
    id: string;
    report_type: string;
    content_hash: string | null;
    generated_at: Date | null;
  }> = await manager.query(
    `SELECT j."id", j."report_type", j."content_hash", j."generated_at"
       FROM "export_job_sources" s JOIN "export_jobs" j ON j."id" = s."export_job_id"
      WHERE s."revision_id" = $1 AND j."state" = 'completed'
      ORDER BY j."created_at", j."id" LIMIT 100`,
    [revisionId],
  );
  return rows.map((row) => ({
    exportId: row.id,
    reportType: row.report_type,
    contentHash: row.content_hash,
    generatedAt: row.generated_at
      ? new Date(row.generated_at).toISOString()
      : null,
  }));
}

/** One cause of a (reused) change proposal, oldest first. */
export interface ProposalTriggerEntry {
  trigger: ChangeTrigger;
  reason: string | null;
  at: string;
}

const reasonOf = (detail: Record<string, unknown> | null | undefined) =>
  typeof detail?.reason === 'string' ? detail.reason : null;

/**
 * Marun E2E note D: every cause of an open proposal, oldest first. A proposal reused by a later change
 * (one open proposal per approved revision) keeps the earlier triggers instead of overwriting them; a
 * proposal from before this list starts with its stored trigger.
 */
export function triggerHistory(
  open: Pick<
    PeriodChangeProposal,
    'trigger' | 'detail' | 'updatedAt' | 'createdAt'
  > | null,
  draft: Pick<ProposalDraft, 'trigger' | 'detail'>,
  at: Date = new Date(),
): ProposalTriggerEntry[] {
  const latest = {
    trigger: draft.trigger,
    reason: reasonOf(draft.detail),
    at: at.toISOString(),
  };
  if (!open) return [latest];
  const stored = open.detail?.triggers;
  const earlier: ProposalTriggerEntry[] = Array.isArray(stored)
    ? (stored as ProposalTriggerEntry[])
    : [
        {
          trigger: open.trigger,
          reason: reasonOf(open.detail),
          at: (open.updatedAt ?? open.createdAt ?? at).toISOString(),
        },
      ];
  return [...earlier, latest];
}

/** The open proposal refreshed with the draft, or a new open proposal. */
async function saveProposal(
  manager: EntityManager,
  open: PeriodChangeProposal | null,
  draft: ProposalDraft,
  actor: Actor,
): Promise<PeriodChangeProposal> {
  // a system change refreshing a manual proposal keeps what the user proposed (trigger, reason, evidence)
  const manual: unknown = open?.detail?.manual;
  const triggers = triggerHistory(open, draft);
  const values = {
    trigger: open && manual ? open.trigger : draft.trigger,
    inputHash: draft.inputHash,
    before: draft.before,
    after: draft.after,
    detail:
      open && manual
        ? { ...draft.detail, manual, systemTrigger: draft.trigger, triggers }
        : { ...draft.detail, triggers },
    affectedReports: await affectedReportsOf(manager, draft.approved.id),
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
