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
}

export interface LineEvidenceRef {
  eventId: string;
  eventRevisionId?: string | null;
}

export type DraftAction = 'accept' | 'adjust' | 'replace' | 'reject' | 'manual';
export type ManualKind = 'availability' | 'performance' | 'quality' | 'bridge' | 'gain' | 'unaccounted_classified';
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
  evidenceType?: EvidenceType;
  evidenceRef?: string;
  reason: string | null;
  comment: string | null;
  authorId: string | null;
  /** baseline_changed | candidate_missing */
  flags: string[];
}

export interface ToleranceView {
  policyId: string | null;
  version: number | null;
  mode: 'zero' | 'percent' | 'absolute';
  value: number;
  epsilon: number;
  allowUnaccountedClassification: boolean;
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
