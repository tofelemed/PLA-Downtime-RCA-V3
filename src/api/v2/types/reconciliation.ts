import type { MonthCloseState } from './month-close';
import type { CodingGateView } from './stop-coding';
/**
 * Reconciliation and approval views (backend `src/v2/reconciliation/reconciliation-v2.view.ts`, plan 2.8);
 * quantities are signed decimal strings, never numbers.
 */
export type RevisionLifecycle = 'draft' | 'in_review' | 'approved' | 'cancelled';

export interface RevisionWorkflowView {
  id: string;
  revision: number;
  lifecycle: RevisionLifecycle;
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
  /** who opened this revision of an approved period (revise / accepted proposal); null for a first revision (absent from older servers) */
  openedBy?: string | null;
  comment: string | null;
}

/** Per-slice plan identity after the saved decisions (ACC07–ACC09). */
export interface SliceReconciliationView {
  sliceId: string;
  uom: string | null;
  target: string | null;
  actual: string | null;
  gap: string | null;
  attributed: string;
  toleranceAdjustment: string;
  unadjustedResidual: string | null;
  residual: string | null;
  overAccounted: string | null;
  overproduction: string | null;
  tolerance: string;
  flags: string[];
}

export type CandidateState = 'proposed' | 'accepted' | 'adjusted' | 'replaced' | 'rejected';

export interface CandidateView {
  lossLineId: string;
  autoKey: string;
  sliceId: string;
  kind: string;
  quantity: string | null;
  basis: string;
  reasonCodeId: string | null;
  impactCodeId: string | null;
  causeEventId: string | null;
  state: CandidateState;
  effectiveQuantity: string | null;
  /** UX D-2: the stored inputs the engine used (absent from older servers) */
  derivation?: CandidateDerivationView;
  /** UX G-4: RCA state of the cause event (null = event not found; absent = no cause event) */
  causeEventRca?: EventRcaView | null;
}

/** UX G-4: an event's RCA state and investigation, as the event list exposes them. */
export interface EventRcaView {
  /** none | required | linked | completed */
  state: string;
  caseId: string | null;
}

/** RCA of an event a saved line cites (`evidence[].eventId`). */
export interface LinkedEventRcaView extends EventRcaView {
  eventId: string;
}

/** UX D-2: the rate the engine computed the line with (stored since 2026-10-18; null on older runs). */
export interface AppliedRateView {
  /** quantity per timebase, decimal string — the planning rate scaled to target on scaled plan slices */
  value: string;
  timebase: string | null;
}

/** The approved rate version a time-based candidate was based on (backend `candidate-derivation.ts`). */
export interface DerivationRateView {
  versionId: string;
  kind: string | null;
  /** quantity per timebase, decimal string — the approved value, not the applied one when scaled */
  value: string | null;
  /** s | min | h | d */
  timebase: string | null;
}

/** One cause allocation behind a candidate (`loss_line_evidence`). */
export interface DerivationEvidenceView {
  eventId: string | null;
  eventRevisionId: string | null;
  occurrenceId: string | null;
  /** share of the segment allocated to this cause, decimal string 0..1 */
  share: string;
  clippedStart: string;
  clippedEnd: string;
}

/** UX D-2: how the engine derived a candidate, as stored (no recomputation). */
export interface CandidateDerivationView {
  basis: string;
  ledger: string;
  segmentStart: string;
  segmentEnd: string;
  durationSeconds: number;
  rate: DerivationRateView | null;
  /** SME Q1: the planning rate was scaled to the target (`appliedRate` holds the scaled rate when stored) */
  rateScaledToTarget: boolean;
  /** the rate the quantity was computed with; null/absent on non-rate lines and runs before it was stored */
  appliedRate?: AppliedRateView | null;
  sourceEventId: string | null;
  occurrenceId: string | null;
  evidence: DerivationEvidenceView[];
  flags: string[];
}

/** SME R4: how an approved period of the month may be corrected. */
export type CorrectionPath = 'direct' | 'proposal' | 'none';

/** UX D-7: close state of the financial month containing the period. */
export interface MonthCloseStateView {
  state: MonthCloseState;
  /** plant month key `YYYY-MM`; null while the month was never acted on */
  monthKey: string | null;
  correctionPath: CorrectionPath;
}

export interface LineEvidenceRef {
  eventId: string;
  eventRevisionId?: string | null;
}

export type DraftAction = 'accept' | 'adjust' | 'replace' | 'reject' | 'manual';
/** `reversal` (SME R9): evidence-backed reversal of an approved line of an earlier period of the unit */
export type ManualKind = 'availability' | 'performance' | 'quality' | 'bridge' | 'gain' | 'unaccounted_classified' | 'reversal';
/** SME R11: the record a manual quantity rests on when no event or approved adjustment backs it. */
export type EvidenceType = 'log' | 'work_order' | 'rate_record' | 'totalizer' | 'lot_sample' | 'movement_record' | 'measurement_record' | 'investigation_note';

export interface ReconciliationLineView {
  id: string;
  position: number;
  action: DraftAction | 'tolerance';
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
  /** SME R9: the approved line of an earlier period a reversal reverses */
  reversesLineId?: string;
  evidenceType?: EvidenceType;
  evidenceRef?: string;
  reason: string | null;
  comment: string | null;
  authorId: string | null;
  /** baseline_changed | candidate_missing */
  flags: string[];
  /** UX G-4: RCA state of the cited events that were found (absent from older servers) */
  linkedEventRca?: LinkedEventRcaView[];
}

export interface ToleranceView {
  policyId: string | null;
  version: number | null;
  mode: 'zero' | 'percent' | 'absolute';
  value: number;
  epsilon: number;
  allowUnaccountedClassification: boolean;
  /** SME D12: shift submission gate (absent in older versions = warn at 95 %) */
  submitGate?: { mode: 'block' | 'warn'; codedRatioTarget: number };
  /** SME D12: daily-approval gate on day certification (absent = warn at 99 %) */
  dayGate?: { mode: 'block' | 'warn'; codedRatioTarget: number };
  /** SME R8: per-unit bridge limits (null = no limit) */
  bridgeLimits?: { absolute: number | null; relative: number | null; overLimit: 'second_review' | 'refuse'; uncertaintyBudgetId?: string };
  /** SME R9: kinds a reversal may reverse */
  reversibleKinds?: string[];
  /** SME E4: the uncertainty budget that justifies an absolute tolerance; absent = none stated */
  uncertaintyBudgetId?: string;
  /** SME E4: that budget's numbers and evidence; null / absent = no budget referenced */
  justification?: ToleranceJustificationView | null;
}

/** SME E4: why the absolute tolerance has its size (backend `uncertainty/tolerance-justification.ts`). */
export interface ToleranceJustificationView {
  budgetId: string;
  found: boolean;
  unitId: string | null;
  boundary: string | null;
  uom: string | null;
  combinedStandardUncertainty: string | null;
  coverageFactor: string | null;
  expandedUncertainty: string | null;
  calibrationRef: string | null;
  reviewDueAt: string | null;
  reviewOverdue: boolean;
  valueMatchesExpandedUncertainty: boolean;
}

export interface ReconciliationView {
  periodId: string;
  unitId: string;
  utcStart: string;
  utcEnd: string;
  rowVersion: number;
  revision: RevisionWorkflowView;
  publishedRevision: number | null;
  baseRunId: string | null;
  contentHash: string;
  tolerance: ToleranceView;
  slices: SliceReconciliationView[];
  candidates: CandidateView[];
  lines: ReconciliationLineView[];
  openProposalId: string | null;
  /** SME D12 / D13: stop coding of the period against the submission gate, and its verification */
  codingGate?: CodingGateView;
  /** SME R8: bridges above the unit limit and their second review of the current submission */
  bridgeReview?: BridgeReviewView;
  /** UX D-7: the month close state of the period (absent from older servers) */
  monthClose?: MonthCloseStateView;
  /** owner, 18 Oct 2026: an approved revision's frozen valuation view vs the current policy (null otherwise) */
  approvedValuation?: ApprovedValuationView | null;
}

/** A valuation policy version and the default view it opens on (backend `approved-valuation-view.ts`). */
export interface ValuationBasisRef {
  view: string;
  policyId: string | null;
  policyVersion: number | null;
}

/** The view frozen in the approval snapshot, the current approved policy's view, and the restatement. */
export interface ApprovedValuationView extends ValuationBasisRef {
  current: ValuationBasisRef;
  differs: boolean;
  restatementProposalId: string | null;
}

/** SME R8 (backend `reconciliation/bridge-review.ts`). */
export interface BridgeReviewView {
  overLimit: 'second_review' | 'refuse';
  findings: Array<{ ref: string; sliceId: string; quantity: string; limit: string; basis: 'absolute' | 'relative' }>;
  required: boolean;
  review: { by: string | null; at: string } | null;
  /** SME E4: the uncertainty budget behind the absolute limit; null = none stated */
  justification?: ToleranceJustificationView | null;
}

/** One line of `PUT …/draft-lines` (DraftLineDto): only declared fields (forbidNonWhitelisted). */
export interface DraftLineInput {
  action: DraftAction;
  autoKey?: string;
  sliceId?: string;
  kind?: ManualKind;
  quantity?: string;
  reasonCodeId?: string;
  impactCodeId?: string;
  eventIds?: string[];
  adjustmentId?: string;
  missingCode?: boolean;
  missingEvent?: boolean;
  reason?: string;
  comment?: string;
  classification?: string;
  evidenceType?: EvidenceType;
  evidenceRef?: string;
  /** SME R9: only on a `reversal` line */
  reversesLineId?: string;
}

export interface ApprovalActionView {
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
  at: string;
}

export interface AffectedReportView {
  exportId: string;
  reportType: string;
  contentHash: string | null;
  generatedAt: string | null;
}

export interface ChangeProposalView {
  id: string;
  periodId: string;
  unitId: string;
  approvedRevisionId: string;
  trigger: string;
  state: string;
  inputHash: string | null;
  before: Record<string, unknown>;
  after: Record<string, unknown> | null;
  affectedReports: AffectedReportView[];
  detail: Record<string, unknown>;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionReason: string | null;
  createdRevisionId: string | null;
  /** SME R4: who proposed a manual correction, its reason and evidence (null for a system proposal) */
  manual: ManualProposalDetail | null;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
}

export interface ManualProposalDetail {
  proposedBy: string;
  reason: string;
  evidenceType: EvidenceType;
  evidenceRef: string;
}

/** `GET /production-periods/{id}/reversible-lines` (SME R9): approved lines of earlier periods a reversal may name. */
export interface ReversibleLineView {
  id: string;
  periodId: string;
  localDate: string;
  shiftName: string | null;
  kind: string;
  quantity: string;
  uom: string | null;
  reasonCodeId: string | null;
  causeEventId: string | null;
  reversedQuantity: string;
  remainingQuantity: string;
}
