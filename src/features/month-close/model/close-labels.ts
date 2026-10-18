import type { MonthCloseState } from '@/api/v2/types/month-close';
import { GRID_WORKFLOW_LABELS } from '@/features/ux-kit/labels/workflow-labels';

/** Plain-language names of the month close states (SME R4). */
export const CLOSE_STATE_LABELS: Record<MonthCloseState, string> = {
  open: 'Open',
  quantities_closed: 'Quantities closed',
  finance_signed_off: 'Finance signed off',
  locked: 'Locked',
};

/** What each history step did. */
export const CLOSE_ACTION_LABELS: Record<string, string> = {
  close_quantities: 'Quantities closed',
  review_materiality: 'Materiality reviewed',
  sign_off_finance: 'Finance signed off',
  lock: 'Month locked',
  reopen: 'Month reopened',
};

/** Workflow of a period that keeps the month from closing. */
/** The shared period workflow wording (owner finding 2): a period in review reads "In review" here too. */
export const PENDING_WORKFLOW_LABELS: Readonly<Record<string, string>> = GRID_WORKFLOW_LABELS;

/** Why a change proposal opened. */
export const PROPOSAL_TRIGGER_LABELS: Record<string, string> = {
  event_change: 'Event changed',
  actuals_change: 'Actuals changed',
  plan_change: 'Plan restated',
  rate_change: 'Rate changed',
  calendar_change: 'Calendar changed',
  source_retraction: 'Source record withdrawn',
  recalculation: 'Recalculated',
  manual_correction: 'Correction proposed',
  valuation_change: 'Valuation input changed',
};

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** ISO weekdays (1 = Monday) as names, e.g. "Thursday and Friday". */
export function weekendText(days: readonly number[]): string {
  const names = days.map((day) => WEEKDAYS[day - 1]).filter(Boolean);
  if (names.length <= 1) return names[0] ?? 'none';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
