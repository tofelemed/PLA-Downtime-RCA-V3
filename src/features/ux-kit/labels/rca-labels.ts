/**
 * Plain labels of RCA tokens (docs/UI_UX_AUDIT.md §6). Case statuses and priorities are already words
 * (`In Progress`, `High`); these maps cover the tokens that are not.
 */
export const RCA_ACTION_STATUS_LABELS: Readonly<Record<string, string>> = {
  open: 'Open',
  in_progress: 'In progress',
  done: 'Done',
  cancelled: 'Cancelled',
};

export const RCA_RECOMMENDATION_STATUS_LABELS: Readonly<Record<string, string>> = {
  open: 'Open',
  Open: 'Open',
  Planned: 'Planned',
  'In Progress': 'In progress',
  in_progress: 'In progress',
  Completed: 'Done',
  done: 'Done',
  Cancelled: 'Cancelled',
  cancelled: 'Cancelled',
};

/** Status of an evidence request (QA L3: a finished step reads "Done" everywhere in RCA). */
export const RCA_EVIDENCE_TASK_LABELS: Readonly<Record<string, string>> = {
  pending: 'Pending',
  completed: 'Done',
};

export const RCA_BASELINE_METRIC_LABELS: Readonly<Record<string, string>> = {
  recurrences: 'Recurrences',
  downtime_seconds: 'Downtime',
};

export const RCA_LINK_SOURCE_LABELS: Readonly<Record<string, string>> = {
  user: 'by a person',
  recommendation: 'from a recommendation',
  trigger: 'by an RCA trigger',
};

export const RCA_SERIES_MODE_LABELS: Readonly<Record<string, string>> = {
  recorded: 'Recorded values',
  interpolated: 'Interpolated',
  summary: 'Summary',
  plot: 'Plot values',
};

export const RCA_FAULT_TREE_NODE_LABELS: Readonly<Record<string, string>> = {
  AND: 'AND gate',
  OR: 'OR gate',
  Event: 'Intermediate event',
  BasicEvent: 'Basic event',
  UndevelopedEvent: 'Undeveloped event',
};

/** CA4 types of corrective action. */
export const RCA_ACTION_TYPE_LABELS: Readonly<Record<string, string>> = {
  repair: 'Repair',
  design_change: 'Design change',
  procedure_change: 'Procedure change',
  instrument_change: 'Instrument change',
  training: 'Training',
  other: 'Other',
};

/** CA2 effectiveness verdicts of the server. */
export const RCA_VERDICT_LABELS: Readonly<Record<string, string>> = {
  effective: 'Effective',
  not_effective: 'Not effective',
  insufficient_evidence: 'Not enough evidence yet',
};

/** CA7 / D-T4 consequence classes (investigation tier). */
export const RCA_CONSEQUENCE_LABELS: Readonly<Record<string, string>> = {
  minor: 'Minor',
  significant: 'Significant',
  major: 'Major',
  critical: 'Critical',
};

/** CA9 status of a lesson in the knowledge base. */
export const RCA_LESSON_STATUS_LABELS: Readonly<Record<string, string>> = {
  verified_practice: 'Verified practice',
  caution: 'Caution: not effective',
  unverified: 'Not verified',
};

/** CA8 how repeats of a problem are recognised. */
export const RCA_REPEAT_MATCH_LABELS: Readonly<Record<string, string>> = {
  asset: 'Same asset',
  asset_and_mode: 'Same asset and failure mode',
  asset_mode_and_mechanism: 'Same asset, failure mode and mechanism',
};

/** Statuses of a proposed baseline correction. */
export const RCA_CORRECTION_STATUS_LABELS: Readonly<Record<string, string>> = {
  pending: 'Waiting for a decision',
  approved: 'Approved',
  rejected: 'Rejected',
};

/** Item 7 kinds of a case cause. */
export const RCA_CAUSE_KIND_LABELS: Readonly<Record<string, string>> = {
  root: 'Root cause',
  direct: 'Direct cause',
  contributing: 'Contributing cause',
};

/** Item 2 history: what was done, by audit action (`<entityType>.<verb>`); others are humanized. */
export const RCA_HISTORY_ACTION_LABELS: Readonly<Record<string, string>> = {
  'rca_case.created': 'Investigation opened',
  'rca_case.updated': 'Investigation details changed',
  'rca_case.transitioned': 'Status changed',
  'rca_case.closure_requested': 'Closure requested',
  'rca_case.closure_rejected': 'Closure sent back',
  'rca_case.closed': 'Investigation closed',
  'rca_case.reopened': 'Investigation reopened',
  'rca_case.deleted': 'Investigation deleted',
  'rca_case.attachment_uploaded': 'File uploaded',
  'rca_case.repaired': 'Data repair',
  'rca_action.created': 'Action added',
  'rca_action.updated': 'Action changed',
  'rca_action.deleted': 'Action removed',
  'rca_action.verified': 'Action effectiveness checked',
  'rca_action.task_completed': 'Linked task completed',
  'rca_action.task_reopened': 'Linked task reopened',
  'rca_action.baseline_correction_proposed': 'Baseline correction proposed',
  'rca_action.baseline_correction_approved': 'Baseline correction approved',
  'rca_action.baseline_correction_rejected': 'Baseline correction rejected',
  'rca_case_link.created': 'Link added',
  'rca_case_link.deleted': 'Link removed',
  'rca_analysis.saved': 'Analysis saved',
  'rca_analysis.updated': 'Analysis changed',
  'rca_cause.created': 'Cause added',
  'rca_cause.updated': 'Cause changed',
  'rca_cause.deleted': 'Cause removed',
};

/** Item 2 history: the record an audit entry is about (fallback wording of unknown actions). */
export const RCA_HISTORY_ENTITY_LABELS: Readonly<Record<string, string>> = {
  rca_case: 'Investigation',
  rca_action: 'Action',
  rca_case_link: 'Link',
  rca_analysis: 'Analysis',
  rca_cause: 'Cause',
};

/** Item 2 history: names of changed fields (others are humanized). */
export const RCA_HISTORY_FIELD_LABELS: Readonly<Record<string, string>> = {
  status: 'Status',
  ownerId: 'Owner',
  dueDate: 'Due date',
  teamLeadId: 'Team lead',
  teamMemberIds: 'Team members',
  priority: 'Priority',
  targetCloseDate: 'Target close date',
  unitId: 'Unit',
  assetId: 'Asset',
  kind: 'Kind of cause',
  causeCodeId: 'Cause code',
  recommendationId: 'Recommendation',
  rootCause: 'Root cause',
  rootCauseLength: 'Root cause (characters)',
  statement: 'Statement',
  statementLength: 'Statement (characters)',
  evidenceIds: 'Supporting evidence',
  nodeIds: 'Logic-tree nodes',
  verificationWindowStart: 'Verify from',
  verificationWindowEnd: 'Verify until',
  completionEvidenceRef: 'Completion evidence',
  actionType: 'Type of action',
  taskCompletedAt: 'Task completed',
};
