import { AccountingRevision } from '../../accounting/entities/accounting-revision.entity';
import { ApprovalAction } from '../../reconciliation/entities/approval-action.entity';
import { LineEvidenceRef } from '../../reconciliation/entities/reconciliation-line.entity';
import {
  AffectedReport,
  PeriodChangeProposal,
} from '../../reconciliation/entities/period-change-proposal.entity';
import { RevisionState } from '../../reconciliation/revision-state';
import {
  candidatesPart,
  contentHashOf,
  linesPart,
  sliceView,
} from '../../reconciliation/reviewed-content';

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
  reason: string | null;
  comment: string | null;
  authorId: string | null;
  /** baseline_changed | candidate_missing */
  flags: string[];
}

export interface ReconciliationV2View {
  periodId: string;
  unitId: string;
  utcStart: string;
  utcEnd: string;
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
  };
  slices: SliceReconciliationV2View[];
  candidates: CandidateV2View[];
  lines: ReconciliationLineV2View[];
  openProposalId: string | null;
}

export function toRevisionWorkflowView(
  r: AccountingRevision,
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
    comment: r.comment,
  };
}

/** The editor's view of a revision (ACC07): totals per slice, candidates with decisions, saved lines. */
export function toReconciliationView(
  state: RevisionState,
  extra: { publishedRevision: number | null; openProposalId: string | null },
): ReconciliationV2View {
  const { period, revision, tolerance } = state;
  return {
    periodId: period.id,
    unitId: period.unitId,
    utcStart: period.utcStart.toISOString(),
    utcEnd: period.utcEnd.toISOString(),
    rowVersion: revision.rowVersion,
    revision: toRevisionWorkflowView(revision),
    publishedRevision: extra.publishedRevision,
    baseRunId: state.run?.id ?? null,
    contentHash: contentHashOf(state),
    tolerance: {
      policyId: tolerance.policyId,
      version: tolerance.version,
      ...tolerance.body,
    },
    slices: state.reconciliation.slices.map(sliceView),
    candidates: candidatesPart(state),
    lines: linesPart(state),
    openProposalId: extra.openProposalId,
  };
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
  at: string;
}

export function toApprovalActionView(a: ApprovalAction): ApprovalActionV2View {
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
  createdRevisionId: string | null;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
}

export function toProposalView(p: PeriodChangeProposal): ChangeProposalV2View {
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
    createdRevisionId: p.createdRevisionId,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    rowVersion: p.rowVersion,
  };
}
