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
  Completed: 'Completed',
  done: 'Completed',
  Cancelled: 'Cancelled',
  cancelled: 'Cancelled',
};

export const RCA_EVIDENCE_TASK_LABELS: Readonly<Record<string, string>> = {
  pending: 'Pending',
  completed: 'Completed',
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

/** CA7 consequence classes (investigation tier). */
export const RCA_CONSEQUENCE_LABELS: Readonly<Record<string, string>> = {
  minor: 'Minor',
  significant: 'Significant',
  major: 'Major',
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
