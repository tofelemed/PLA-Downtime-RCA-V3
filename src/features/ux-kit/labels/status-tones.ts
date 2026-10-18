import type { StatusTone } from '../status-tone';

/**
 * Domain value → status tone (UX_AUDIT C-2, §5.8). Labels stay in their label maps; only the tone lives
 * here. An unmapped value is neutral (`toneOf`).
 */

/** Plan, profile, rate, FX and calendar versions (calendars are published, not approved). */
export const VERSION_STATE_TONES: Readonly<Record<string, StatusTone>> = {
  draft: 'neutral',
  submitted: 'info',
  approved: 'success',
  published: 'success',
  superseded: 'neutral',
  retired: 'neutral',
};

/**
 * Period accounting workflow (grid `workflowState`, event `accountingState`): approved is done, in review
 * is in progress, inputs changed after submission is a data-quality warning, draft / not calculated neutral.
 */
export const GRID_WORKFLOW_TONES: Readonly<Record<string, StatusTone>> = {
  none: 'neutral',
  draft: 'neutral',
  in_review: 'info',
  stale: 'warning',
  approved: 'success',
};

/** Accounting revision lifecycle (period header, history). */
export const REVISION_LIFECYCLE_TONES: Readonly<Record<string, StatusTone>> = {
  draft: 'neutral',
  in_review: 'info',
  approved: 'success',
  cancelled: 'neutral',
};

/**
 * Task and RCA case priority. Only Critical is red and High amber; Medium and Low stay neutral so the
 * urgent rows stand out (a blue Medium on most rows would be noise).
 */
export const PRIORITY_TONES: Readonly<Record<string, StatusTone>> = {
  Critical: 'danger',
  High: 'warning',
  Medium: 'neutral',
  Low: 'neutral',
};

export const TASK_STATUS_TONES: Readonly<Record<string, StatusTone>> = {
  Open: 'neutral',
  'In Progress': 'info',
  Completed: 'success',
  Cancelled: 'neutral',
};

/** RCA case workflow: Closed is done, the working stages are in progress, Draft is not started. */
export const RCA_CASE_STATUS_TONES: Readonly<Record<string, StatusTone>> = {
  Draft: 'neutral',
  'In Progress': 'info',
  Analysis: 'info',
  Published: 'info',
  Monitoring: 'info',
  'Closure Review': 'info',
  Closed: 'success',
};

/** RCA action statuses (item 5 chips on recommendations): done is success, in progress is info. */
export const RCA_ACTION_STATUS_TONES: Readonly<Record<string, StatusTone>> = {
  open: 'neutral',
  in_progress: 'info',
  done: 'success',
  cancelled: 'neutral',
};

/** Integration console health (`ok / busy / idle / warning / error`, model/job-states). */
export const INTEGRATION_TONES: Readonly<Record<string, StatusTone>> = {
  ok: 'success',
  busy: 'info',
  idle: 'neutral',
  warning: 'warning',
  error: 'danger',
};
