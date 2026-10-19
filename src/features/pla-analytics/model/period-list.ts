import type { PeriodSummaryListQuery } from '@/api/v2/queries/period-summaries';
import type { GridWorkflowState, ResidualState } from '@/api/v2/types/period-overview';
import { GRID_WORKFLOW_LABELS, RESIDUAL_LABELS } from '@/features/ux-kit/labels';
import type { AnalyticsScope } from './analytics-scope';

/** URL parameter of the cross-plan period list on the Reconciliation page (UX D-6): `?periods=<state>`. */
export const PERIODS_PARAM = 'periods';

/** `?periods=quality`: every period of the scope, each opening its Actuals & quality (lot dispositions, QA PLA M3). */
export const QUALITY_PERIODS = 'quality';

/** A workflow or residual state, or every period for its dispositions; the names do not overlap, so one parameter carries any. */
export type PeriodListFilter = { kind: 'workflow'; state: GridWorkflowState } | { kind: 'residual'; state: ResidualState } | { kind: 'quality'; state: typeof QUALITY_PERIODS };

const has = (map: Readonly<Record<string, string>>, key: string) => Object.prototype.hasOwnProperty.call(map, key);

export function parsePeriodListFilter(search: URLSearchParams): PeriodListFilter | null {
  const value = search.get(PERIODS_PARAM) ?? '';
  if (value === QUALITY_PERIODS) return { kind: 'quality', state: QUALITY_PERIODS };
  if (has(GRID_WORKFLOW_LABELS, value)) return { kind: 'workflow', state: value as GridWorkflowState };
  if (has(RESIDUAL_LABELS, value)) return { kind: 'residual', state: value as ResidualState };
  return null;
}

/** The current URL with the list opened on `state` (empty = back to the counts), other parameters kept. */
export function withPeriodList(search: URLSearchParams, state: string): string {
  const next = new URLSearchParams(search);
  if (state) next.set(PERIODS_PARAM, state);
  else next.delete(PERIODS_PARAM);
  return `?${next}`;
}

/** The server list of the scope's units and window in that state (current revision, newest first, every plan). */
export function periodListQuery(scope: AnalyticsScope, filter: PeriodListFilter): PeriodSummaryListQuery {
  const base: PeriodSummaryListQuery = { from: scope.from, to: scope.to, view: 'current', sort: '-utcStart' };
  if (scope.unitIds.length > 0) base.unitIds = [...scope.unitIds].sort();
  if (filter.kind === 'quality') return base;
  return filter.kind === 'workflow' ? { ...base, workflowState: [filter.state] } : { ...base, residualStates: [filter.state] };
}

export function periodListTitle(filter: PeriodListFilter): string {
  if (filter.kind === 'quality') return 'Periods · quality losses from lot dispositions';
  return filter.kind === 'workflow' ? `Periods · ${GRID_WORKFLOW_LABELS[filter.state]}` : `Periods · Unaccounted: ${RESIDUAL_LABELS[filter.state]}`;
}

/** The period's page a row opens: Actuals & quality for the dispositions list, else the period itself. */
export function periodRowHref(filter: PeriodListFilter, planId: string, periodId: string): string {
  const base = `/plans/${encodeURIComponent(planId)}/periods/${encodeURIComponent(periodId)}`;
  return filter.kind === 'quality' ? `${base}/actuals` : base;
}
