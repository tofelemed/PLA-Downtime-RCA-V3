import type { ExceptionTarget, ExceptionType, ExceptionWorkflow } from '@/api/v2/types/reconciliation-exceptions';
import { periodStopsHref } from '@/features/plan-dashboard/coding/period-stops-href';

/** Problem types in display order with their filter / column labels. */
export const EXCEPTION_TYPE_LABELS: ReadonlyArray<readonly [ExceptionType, string]> = [
  ['residual_beyond_tolerance', 'Residual beyond tolerance'],
  ['claim_exceeds_component', 'Claims exceed measurement'],
  ['bridge_required', 'Bridge decision needed'],
  ['plan_allocation_required', 'Plan allocation needed'],
  ['stale_submission', 'Stale submission'],
  ['substitute_source', 'Substitute actuals source'],
  ['uncoded_stop_time', 'Uncoded stops'],
  ['duplicate_merge_pending', 'Duplicate stops to review'],
];

export const WORKFLOW_LABELS: Readonly<Record<ExceptionWorkflow, string>> = {
  none: 'Not started',
  draft: 'Draft',
  in_review: 'In review',
  stale: 'In review (stale)',
};

export function isExceptionType(value: string): value is ExceptionType {
  return EXCEPTION_TYPE_LABELS.some(([type]) => type === value);
}

export function typeLabel(type: ExceptionType): string {
  return EXCEPTION_TYPE_LABELS.find(([value]) => value === type)?.[1] ?? type;
}

const PERIOD_SECTION_PATH: Readonly<Record<'reconciliation' | 'actuals' | 'review', string>> = {
  reconciliation: '',
  actuals: '/actuals',
  review: '/review',
};

/** The screen that fixes a row, from the server's target; null = no screen yet (no plan covers the period). */
export function exceptionHref(target: ExceptionTarget): string | null {
  switch (target.screen) {
    case 'period':
      return `/plans/${encodeURIComponent(target.planId)}/periods/${encodeURIComponent(target.periodId)}${PERIOD_SECTION_PATH[target.section]}`;
    case 'events':
      return periodStopsHref({ unitId: target.unitId, utcStart: target.from, utcEnd: target.to }, 'uncoded');
    case 'stop_merge':
      return `/events/${encodeURIComponent(target.eventId)}?tab=related#stop-merge-${encodeURIComponent(target.reconciliationId)}`;
    case 'stop_merges':
      return '/approvals?kind=stop-merge';
    default:
      return null;
  }
}

/** What the link says: the screen it opens. */
export function exceptionLinkText(target: ExceptionTarget): string {
  if (target.screen === 'events') return 'Code stops';
  if (target.screen === 'stop_merge' || target.screen === 'stop_merges') return 'Review duplicates';
  if (target.screen === 'period' && target.section === 'actuals') return 'Open actuals';
  if (target.screen === 'period' && target.section === 'review') return 'Open review';
  return 'Open reconciliation';
}
