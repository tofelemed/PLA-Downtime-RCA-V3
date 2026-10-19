/**
 * v2 RCA views (plan 3.9; backend `src/rca-case/*.view.ts`, `rca-links.service.ts`,
 * `rca-recommendations.service.ts`, `rca-actions.service.ts`). Decimals are strings.
 */
import type {
  RcaActionBaseline,
  RcaActionType,
  RcaCompletionAttachment,
  RcaEffectivenessResult,
  RcaEffectivenessVerdict,
  RcaExposureWindow,
} from './rca-workflow';

/** RCA-01 workflow statuses (`Published` is a v1 status read as an analysis-stage case). */
export const RCA_STATUSES = ['Draft', 'In Progress', 'Analysis', 'Published', 'Monitoring', 'Closure Review', 'Closed'] as const;
export type RcaStatus = (typeof RCA_STATUSES)[number];
export const RCA_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;
export type RcaPriority = (typeof RCA_PRIORITIES)[number];
export const RCA_LINK_TYPES = ['event', 'loss_line', 'work_order', 'occurrence'] as const;
export type RcaLinkType = (typeof RCA_LINK_TYPES)[number];

export interface RcaRecommendationItem {
  id: string;
  title: string;
  description: string | null;
  priority: string | null;
  ownerId: string | null;
  dueDate: string | null;
  status: string | null;
  /** decimal string, no currency */
  /** absent for a caller without the money capability (operators, QA re-test 2026-10-19) */
  estimatedCost?: string | null;
  /** read-only (item 5): the case's actions implementing this recommendation; never sent back */
  actions?: RcaRecommendationActionRef[];
}

/** An action implementing a recommendation, as the case view lists it (item 5). */
export interface RcaRecommendationActionRef {
  id: string;
  title: string;
  status: string;
}

/** Historian query recorded with a time-series evidence item (parameters, not samples). */
export interface RcaEvidenceSeries {
  provider: string | null;
  streams: string | null;
  mode: string | null;
  start: string | null;
  end: string | null;
  interval: string | null;
  intervals: number | null;
  summaryTypes: string | null;
}

export interface RcaEvidenceAttachment {
  /** stored name returned by `POST /v2/rcas/{id}/attachments` */
  fileName: string;
  name: string;
  contentType: string | null;
  size: number | null;
}

export interface RcaEvidenceItem {
  id: string;
  title: string;
  description: string | null;
  type: string | null;
  source: string | null;
  collectedAt: string | null;
  collectedBy: string | null;
  category: string | null;
  location: string | null;
  occurredAt: string | null;
  assetId: string | null;
  severity: string | null;
  tags: string[];
  verified: boolean | null;
  fiveP: string | null;
  task: string | null;
  taskDueDate: string | null;
  taskStatus: string | null;
  /** who has to bring the evidence (a member of the plant; null = not assigned) */
  taskAssigneeId: string | null;
  /** recorded by the server when `verified` becomes true (values sent back are ignored) */
  verifiedBy: string | null;
  verifiedAt: string | null;
  /** logic-tree nodes and diagram events this item supports */
  nodeIds: string[];
  timeSeries: RcaEvidenceSeries | null;
  attachments: RcaEvidenceAttachment[];
}

export interface RcaLogicNode {
  id: string;
  parentId: string | null;
  label: string;
  kind: string | null;
  status: string | null;
  notes: string | null;
  code: string | null;
  description: string | null;
  verified: boolean | null;
}

export interface RcaDiagramNode {
  id: string;
  label: string;
  type: string | null;
  timestamp: string | null;
  description: string | null;
  asset: string | null;
  severity: string | null;
  position: { x: number; y: number };
}

export interface RcaDiagramEdge {
  id: string;
  source: string;
  target: string;
}

export interface RcaEventDiagram {
  nodes: RcaDiagramNode[];
  edges: RcaDiagramEdge[];
}

export interface RcaCaseSummaryView {
  id: string;
  title: string;
  status: string | null;
  priority: string | null;
  unitId: string | null;
  assetId: string | null;
  teamLeadId: string | null;
  targetCloseDate: string | null;
  actualCloseDate: string | null;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
}

/** A row of `GET /v2/rcas` (U3): the first linked event (by link time) and the action counts. */
export interface RcaCaseListItemView extends RcaCaseSummaryView {
  trigger: { eventId: string; startTime: string; unitId: string } | null;
  /** `total` leaves cancelled actions out; `overdue` = open or in progress past the due date */
  actions: { total: number; done: number; overdue: number };
}

export interface RcaCaseView extends RcaCaseSummaryView {
  description: string | null;
  teamMemberIds: string[];
  rootCause: string | null;
  templateId: string | null;
  recommendations: RcaRecommendationItem[];
  evidence: RcaEvidenceItem[];
  logicTree: RcaLogicNode[];
  teamCharter: string | null;
  eventDiagram: RcaEventDiagram;
  createdBy: string | null;
  /** minor | significant | major (CA7 investigation tier), null = not classified */
  consequenceClass: string | null;
  /** CA1 closure: residual risk, request, independent approval and the reviewer's note */
  residualRisk: string | null;
  closureRequestedBy: string | null;
  closureRequestedAt: string | null;
  closureApprovedBy: string | null;
  closureApprovedAt: string | null;
  closureNote: string | null;
  /** CA2 effectiveness frozen when closure was requested */
  effectivenessVerdict: string | null;
}

/** Counts of the cases in scope (`GET /v2/rcas/summary`). */
export interface RcaCaseSummaryCounts {
  total: number;
  /** cases not closed */
  open: number;
  overdue: number;
  critical: number;
  /** open or in-progress actions past their due date */
  overdueActions: number;
  /** actions with a baseline and a verification window whose effectiveness result is not in yet */
  effectivenessPending: number;
  byStatus: Array<{ status: string | null; count: number }>;
  asOf: string;
}

export interface RcaEvidenceOptions {
  categories: string[];
  locations: string[];
}

export type RcaAttachmentView = RcaEvidenceAttachment & { size: number };

/** One currency of the approved impact (same valued / unvalued / mixed semantics as the loss-value report). */
export interface ApprovedImpactValueView {
  currency: string;
  amount: string | null;
  valuedLines: number;
  unvaluedLines: number;
  /** absent on evidence packages frozen before SME V7 / V8 */
  provisionalLines?: number;
  status?: 'valued' | 'unvalued' | 'mixed';
  /** SME V7: converted (partly) with a provisional exchange rate */
  fxProvisional?: boolean;
}

export interface ApprovedImpactView {
  lines: number;
  quantities: Array<{ kind: string; uom: string | null; quantity: string }>;
  /** SME V8: valuation view of `values` (the policy default); absent on packages frozen before it (contribution margin) */
  view?: 'contribution_margin' | 'standard_cost' | 'economic_impact';
  /** absent for a caller without the money capability (operators, QA re-test 2026-10-19) */
  values?: ApprovedImpactValueView[];
  basis: string;
}

export interface EventEvidencePackageView {
  kind: 'event';
  builtAt: string;
  event: {
    id: string;
    rowVersion: number;
    unitId: string;
    assetId: string | null;
    occurrenceId: string | null;
    eventType: string | null;
    physicalType: string;
    scheduleClass: string;
    physicalState: string;
    start: string;
    end: string | null;
    durationSeconds: number | null;
    workOrderId: string | null;
  };
  revisions: Array<{ revision: number; kind: string; actorKind: string | null; sourceRevision: string | null; createdAt: string }>;
  trendWindow: { from: string; to: string; signalIds: string[] };
  causeCodes: {
    reasonCode: { id: string; code: string | null; name: string | null; versionId: string | null } | null;
    impactCode: { id: string; code: string | null; name: string | null; versionId: string | null } | null;
    failureMode: string | null;
  };
  recurrence: { windowDays: number; sameAsset: number | null; sameReason: number | null };
  approvedImpact: ApprovedImpactView;
}

export interface RcaLinkView {
  id: string;
  rcaId: string;
  linkType: RcaLinkType;
  targetId: string;
  targetRevision: number | null;
  unitId: string | null;
  source: string;
  linkedBy: string | null;
  linkedAt: string;
  reason: string | null;
  /** evidence package snapshot (event packages follow `EventEvidencePackageView`) */
  evidence: Record<string, unknown> | null;
}

export interface RcaLinkResultView {
  link: RcaLinkView;
  created: boolean;
  caseCreated: boolean;
  rca: RcaCaseSummaryView;
}

export interface RcaRecommendationEventFacts {
  reasonCodeId: string | null;
  reasonName: string | null;
  assetId: string | null;
  assetName: string | null;
  startTime: string;
  /** the event's kind; absent from older servers */
  physicalType?: string;
}

export interface RcaRecommendationView {
  id: string;
  eventId: string;
  occurrenceId: string | null;
  unitId: string;
  trigger: string;
  source: { kind: string; id: string; version: number };
  firedOn: string;
  provisional: boolean;
  outcome: string;
  state: string;
  rcaId: string | null;
  /** F-1: facts of the event (null when the event is not readable any more) */
  event: RcaRecommendationEventFacts | null;
  detail: Record<string, unknown>;
  firedAt: string;
  confirmedAt: string | null;
  resolvedAt: string | null;
}

export interface RealizedView {
  metric: string;
  expected: string;
  observed: string;
  difference: string;
}

/** What the verification job observed after the action (exposure and effectiveness since CA2). */
export interface RcaPostAction {
  windowDays: number;
  recurrences: number;
  observedLossSeconds: string;
  from: string;
  to: string;
  evaluatedAt: string;
  realized: RealizedView;
  exposure?: RcaExposureWindow;
  effectiveness?: RcaEffectivenessResult;
}

export interface RcaActionView {
  id: string;
  rcaId: string;
  title: string;
  description: string | null;
  ownerId: string | null;
  dueDate: string | null;
  status: string;
  actionType: RcaActionType | null;
  /** the objective evidence this type of action needs (server text) */
  evidenceExpected: string;
  completionEvidenceRef: string | null;
  completionAttachments: RcaCompletionAttachment[];
  hasEvidence: boolean;
  completedAt: string | null;
  /** who checked the evidence and marked it done (never the owner) */
  completionVerifiedBy: string | null;
  verificationWindowStart: string | null;
  verificationWindowEnd: string | null;
  /** CA4: how the completion is verified (null = not stated) */
  verificationMethod: string | null;
  /** CA4: the named verifier, never the owner; when set, only this person marks the action done */
  verifierId: string | null;
  /** the verification window is fixed once the action is done (409 VERIFICATION_WINDOW_LOCKED) */
  verificationWindowLocked: boolean;
  baseline: RcaActionBaseline | null;
  /** QA L11: the RCA policy version of the baseline's thresholds (frozen with them, else in force when computed); absent in older responses */
  baselinePolicyVersion?: number | null;
  postAction: RcaPostAction | null;
  verificationStatus: 'not_planned' | 'pending' | 'due' | 'evaluated';
  verdict: RcaEffectivenessVerdict | null;
  /** absent for a caller without the money capability (operators, QA re-test 2026-10-19) */
  claimedAvoidedLoss?: { amount: string; currency: string | null } | null;
  /** F-9: why, who and when, while the action is cancelled (null otherwise or when no reason was given) */
  cancelReason: string | null;
  cancelledBy: string | null;
  cancelledAt: string | null;
  /** item 5: the case recommendation this action implements (null = none) */
  recommendationId: string | null;
  /** item 5: the open (else the latest) task of Task Management carrying out this action */
  linkedTask: RcaActionTaskView | null;
  /** item 5: when the linked task was completed — recorded only, the action still needs its evidence */
  taskCompletedAt: string | null;
  createdAt: string;
  rowVersion: number;
}

/** The Task Management task linked to an action (item 5). */
export interface RcaActionTaskView {
  id: string;
  status: string;
  assigneeId: string;
  dueDate: string | null;
  completedAt: string | null;
}

export interface RcaOutcomeView {
  rcaId: string;
  approvedHistoricalLoss: ApprovedImpactView;
  /** absent for a caller without the money capability (operators, QA re-test 2026-10-19) */
  claimedAvoided?: Array<{ currency: string; amount: string; actions: number }>;
  realized: Array<RealizedView & { actionId: string; title: string; verdict: RcaEffectivenessVerdict | null }>;
  note: string;
}
