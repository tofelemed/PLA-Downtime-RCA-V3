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
