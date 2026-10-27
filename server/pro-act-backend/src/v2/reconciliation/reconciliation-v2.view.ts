import { AccountingRevision } from '../../accounting/entities/accounting-revision.entity';
import { ApprovalAction } from '../../reconciliation/entities/approval-action.entity';
import { LineEvidenceRef } from '../../reconciliation/entities/reconciliation-line.entity';
import {
  AffectedReport,
  PeriodChangeProposal,
} from '../../reconciliation/entities/period-change-proposal.entity';
import {
  ManualProposalDetail,
  manualDetailOf,
} from '../../reconciliation/manual-proposal';
import { ProposalAfterValues } from './proposal-after-values';
import { CodingGateResult } from '../../domain/reconciliation/coding-gate';
import { isSelfDecision } from '../../domain/approvals/self-decision';
import { revisionSelfApproved } from '../../domain/reconciliation/self-approval';
import { BridgeReviewState } from '../../reconciliation/bridge-review';
import { RevisionState } from '../../reconciliation/revision-state';
import { spansOperationalDay } from '../../periods/day-grain';
import { LossStatementView } from '../loss-statement/loss-statement';
import { LossBasis } from '../../periods/loss-accounting-policy';
import { ToleranceJustification } from '../../uncertainty/tolerance-justification';
import {
  candidatesPart,
  contentHashOf,
  linesPart,
  sliceView,
} from '../../reconciliation/reviewed-content';
import { ApprovedValuationV2View } from './approved-valuation-view';
import { CandidateDerivationV2View } from './candidate-derivation';
import {
  EventRcaV2View,
  LinkedEventRcaV2View,
  withCandidateRca,
  withLinkedEventRca,
} from './event-rca';
import { MonthCloseStateV2View } from './month-close-state';

const iso = (value: Date | null) => (value ? value.toISOString() : null);

export interface RevisionWorkflowV2View {
  id: string;
  revision: number;
  lifecycle: string;
  supersedesId: string | null;
  currentRunId: string | null;
  currentLineSetId: string | null;
  isStale: boolean;
  staleReason: string | null;
  submittedBy: string | null;
  submittedAt: string | null;
  submittedHash: string | null;
  submittedRunId: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  approvalSnapshotId: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectReason: string | null;
  cancelledBy: string | null;
  cancelledAt: string | null;
  /** SME R4: a correction opened through a change proposal of a locked month */
  afterClose: boolean;
  /**
   * who opened this revision of an approved period (revise or an accepted change proposal); null for a
   * first revision. They never approve it (SEPARATION_OF_DUTIES), so the UI can say why.
   */
  openedBy: string | null;
  /**
   * item 1.3: approved by its submitter, opener, a line author or its bridge reviewer — a SuperAdmin
   * self-approval (owner decision 2026-10-16); false until approved
   */
  selfDecided: boolean;
  comment: string | null;
}

export type SliceReconciliationV2View = ReturnType<typeof sliceView>;

export interface CandidateV2View {
  lossLineId: string;
  autoKey: string | null;
  sliceId: string;
  kind: string;
  quantity: string | null;
  basis: string;
  reasonCodeId: string | null;
  impactCodeId: string | null;
  causeEventId: string | null;
  /** proposed | accepted | adjusted | replaced | rejected */
  state: string;
  effectiveQuantity: string | null;
  /** UX D-2: the stored inputs the engine derived the candidate from (absent when not loaded) */
  derivation?: CandidateDerivationV2View;
  /** UX G-4: RCA state of the cause event (null = event not found; absent = no cause event / not loaded) */
  causeEventRca?: EventRcaV2View | null;
}

export interface ReconciliationLineV2View {
  id: string;
  position: number;
  action: string;
  autoKey: string | null;
  sliceId: string;
  kind: string | null;
  quantity: string | null;
  baseQuantity: string | null;
  uom: string | null;
  basis: string | null;
  reasonCodeId: string | null;
  impactCodeId: string | null;
  evidence: LineEvidenceRef[];
  adjustmentId: string | null;
  missingCode: boolean;
  missingEvent: boolean;
  /** SME R7 / R8: category of an Unaccounted or bridge line */
  classification?: string;
  /** SME R11: the record a manual quantity rests on */
  evidenceType?: string;
  evidenceRef?: string;
  /** SME R9: the approved line of an earlier period this reversal reverses */
  reversesLineId?: string;
  reason: string | null;
  comment: string | null;
  authorId: string | null;
  /** baseline_changed | candidate_missing */
  flags: string[];
  /** UX G-4: RCA state of the events in `evidence` that were found (absent = no evidence / not loaded) */
  linkedEventRca?: LinkedEventRcaV2View[];
}

export interface ReconciliationV2View {
  periodId: string;
  unitId: string;
  utcStart: string;
  utcEnd: string;
  /** the period spans its whole operational day (daily accounting grain), else a shift */
  isDayGrain: boolean;
  /** loss basis the revision's run was calculated with; null = no run yet */
  lossBasis: LossBasis | null;
  /** the revision's row version (ETag; If-Match of draft-lines) */
  rowVersion: number;
  revision: RevisionWorkflowV2View;
  /** number of the published (latest approved) revision, null before the first approval */
  publishedRevision: number | null;
  /** the run the candidates come from (send as baseRunId / runId) */
  baseRunId: string | null;
  /** sha256 of the reviewed content (send as contentHash on submit) */
  contentHash: string;
  tolerance: {
    policyId: string | null;
    version: number | null;
    mode: string;
    value: number;
    epsilon: number;
    allowUnaccountedClassification: boolean;
    unaccountedTargetOfShortfall: number | null;
    /** SME E4: the uncertainty budget the absolute tolerance references; absent = none stated */
    uncertaintyBudgetId?: string;
    /** SME E4: that budget's expanded uncertainty and evidence; null = no budget referenced */
    justification: ToleranceJustification | null;
  };
  slices: SliceReconciliationV2View[];
  candidates: CandidateV2View[];
  lines: ReconciliationLineV2View[];
  openProposalId: string | null;
  /** SME D12: stop coding of the period against the policy's submission gate (live, not reviewed content) */
  codingGate: CodingGateResult;
  /** SME R8: bridges above the unit limit and their second review of the current submission */
  bridgeReview: BridgeReviewState;
  /** UX D-7: close state of the period's financial month (locked = correct through a change proposal) */
  monthClose: MonthCloseStateV2View;
  /**
   * Task 13: the loss accounting statement of this revision (server-side sums of its reconciled plan ledger
   * and the run's recovery / transition / classified lines); null without a run
   */
  statement: LossStatementView | null;
  /** owner, 18 Oct 2026: an approved revision's frozen valuation view vs the current policy (else null) */
  approvedValuation: ApprovedValuationV2View | null;
}

export function toRevisionWorkflowView(
  r: AccountingRevision,
  selfDecided = false,
): RevisionWorkflowV2View {
  return {
    id: r.id,
    revision: r.revision,
    lifecycle: r.lifecycle,
    supersedesId: r.supersedesId,
    currentRunId: r.currentRunId,
    currentLineSetId: r.currentLineSetId,
    isStale: r.isStale,
    staleReason: r.staleReason,
    submittedBy: r.submittedBy,
    submittedAt: iso(r.submittedAt),
    submittedHash: r.submittedHash,
    submittedRunId: r.submittedRunId,
    approvedBy: r.approvedBy,
    approvedAt: iso(r.approvedAt),
    approvalSnapshotId: r.approvalSnapshotId,
    rejectedBy: r.rejectedBy,
    rejectedAt: iso(r.rejectedAt),
    rejectReason: r.rejectReason,
    cancelledBy: r.cancelledBy,
    cancelledAt: iso(r.cancelledAt),
    afterClose: r.afterClose,
    openedBy: r.supersedesId ? r.createdBy : null,
    selfDecided,
    comment: r.comment,
  };
}

/** The editor's view of a revision (ACC07): totals per slice, candidates with decisions, saved lines. */
export function toReconciliationView(
  state: RevisionState,
  extra: {
    publishedRevision: number | null;
    openProposalId: string | null;
    codingGate: CodingGateResult;
    bridgeReview: BridgeReviewState;
    justification?: ToleranceJustification | null;
    monthClose: MonthCloseStateV2View;
    statement?: LossStatementView | null;
    approvedValuation?: ApprovedValuationV2View | null;
    derivations?: ReadonlyMap<string, CandidateDerivationV2View>;
    eventRca?: ReadonlyMap<string, EventRcaV2View>;
  },
): ReconciliationV2View {
  const { period, revision, tolerance } = state;
  return {
    periodId: period.id,
    unitId: period.unitId,
    utcStart: period.utcStart.toISOString(),
    utcEnd: period.utcEnd.toISOString(),
    isDayGrain: spansOperationalDay(period.utcStart, period.utcEnd),
    lossBasis: state.run ? state.lossBasis : null,
    rowVersion: revision.rowVersion,
    revision: toRevisionWorkflowView(
      revision,
      revisionSelfApproved(revision.approvedBy, {
        submittedBy: revision.submittedBy,
        revisionOpenedBy: revision.supersedesId ? revision.createdBy : null,
        lineAuthors: state.lines.map((line) => line.authorId),
        bridgeReviewer: extra.bridgeReview.review?.by ?? null,
      }),
    ),
    publishedRevision: extra.publishedRevision,
    baseRunId: state.run?.id ?? null,
    contentHash: contentHashOf(state),
    tolerance: {
      policyId: tolerance.policyId,
      version: tolerance.version,
      ...tolerance.body,
      justification: extra.justification ?? null,
    },
    slices: state.reconciliation.slices.map(sliceView),
    candidates: withCandidateRca(
      withDerivations(candidatesPart(state), extra.derivations),
      extra.eventRca,
    ),
    lines: withLinkedEventRca(linesPart(state), extra.eventRca),
    openProposalId: extra.openProposalId,
    codingGate: extra.codingGate,
    bridgeReview: extra.bridgeReview,
    monthClose: extra.monthClose,
    statement: extra.statement ?? null,
    approvedValuation: extra.approvedValuation ?? null,
  };
}

/** Candidates with their derivation; the reviewed content (and its hash) never includes it. */
function withDerivations(
  candidates: CandidateV2View[],
  derivations?: ReadonlyMap<string, CandidateDerivationV2View>,
): CandidateV2View[] {
  if (!derivations) return candidates;
  return candidates.map((candidate) => {
    const derivation = derivations.get(candidate.lossLineId);
    return derivation ? { ...candidate, derivation } : candidate;
  });
}

export interface ApprovalActionV2View {
  id: string;
  revisionId: string;
  action: string;
  fromLifecycle: string;
  toLifecycle: string;
  actorId: string | null;
  service: string | null;
  reason: string | null;
  submittedHash: string | null;
  correlationId: string | null;
  /** SME R6: a rejection's failed lines, new due time and count; other steps' context */
  detail: Record<string, unknown>;
  /** item 1.3: an approval, rejection or bridge review of one's own submission (SuperAdmin only) */
  selfDecided: boolean;
  at: string;
}

export function toApprovalActionView(
  a: ApprovalAction,
  selfDecided = false,
): ApprovalActionV2View {
  return {
    id: a.id,
    revisionId: a.revisionId,
    action: a.action,
    fromLifecycle: a.fromLifecycle,
    toLifecycle: a.toLifecycle,
    actorId: a.actorId,
    service: a.service,
    reason: a.reason,
    submittedHash: a.submittedHash,
    correlationId: a.correlationId,
    detail: a.detail ?? {},
    selfDecided,
    at: a.createdAt.toISOString(),
  };
}

export interface ChangeProposalV2View {
  id: string;
  periodId: string;
  unitId: string;
  approvedRevisionId: string;
  trigger: string;
  state: string;
  inputHash: string | null;
  before: Record<string, unknown>;
  after: Record<string, unknown> | null;
  /** completed exports containing the approved revision (plan 2.9) */
  affectedReports: AffectedReport[];
  detail: Record<string, unknown>;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionReason: string | null;
  /** item 1.3: a manual proposal accepted or dismissed by its proposer (SuperAdmin only) */
  selfDecided: boolean;
  createdRevisionId: string | null;
  /** SME R4: who proposed a manual correction, its reason and evidence (null for a system proposal) */
  manual: ManualProposalDetail | null;
  /** the loss value of the revision an acceptance opened (null until accepted) — QA audit P-1 */
  valueAfter: ProposalAfterValues | null;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
}

export function toProposalView(
  p: PeriodChangeProposal,
  valueAfter: ProposalAfterValues | null = null,
): ChangeProposalV2View {
  return {
    id: p.id,
    periodId: p.periodId,
    unitId: p.unitId,
    approvedRevisionId: p.approvedRevisionId,
    trigger: p.trigger,
    state: p.state,
    inputHash: p.inputHash,
    before: p.before,
    after: p.after,
    affectedReports: p.affectedReports,
    detail: p.detail,
    resolvedBy: p.resolvedBy,
    resolvedAt: iso(p.resolvedAt),
    resolutionReason: p.resolutionReason,
    selfDecided: isSelfDecision(p.resolvedBy, [manualDetailOf(p)?.proposedBy]),
    createdRevisionId: p.createdRevisionId,
    manual: manualDetailOf(p),
    valueAfter,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    rowVersion: p.rowVersion,
  };
}
