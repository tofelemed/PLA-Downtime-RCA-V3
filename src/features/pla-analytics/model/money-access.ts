import type { LossTreeMetricParam } from '@/api/v2/types/pla-analytics';
import { LOSS_METRICS, type AnalyticsScope } from './analytics-scope';

/** QA re-test N1: the PLA page tabs as the menu lists them — Loss valuation only with `canViewMoney`. */
export function plaPagesFor<T extends { key: string }>(pages: readonly T[], canViewMoney: boolean): T[] {
  return canViewMoney ? [...pages] : pages.filter((page) => page.key !== 'valuation');
}

/**
 * Owner 19 Oct 2026 (QA audit, no money for operators): without `canViewMoney` the PLA pages offer only
 * the lost quantity, never a valuation metric, value export or the cost / margin opportunities.
 */
export function lossMetricsFor(canViewMoney: boolean): readonly LossTreeMetricParam[] {
  return canViewMoney ? LOSS_METRICS : ['qty'];
}

/** The scope a page queries with: a money metric (e.g. from a shared link) falls back to quantity. */
export function scopeForMoneyAccess(scope: AnalyticsScope, canViewMoney: boolean): AnalyticsScope {
  return canViewMoney || scope.lossMetric === 'qty' ? scope : { ...scope, lossMetric: 'qty' };
}

/** Loss breakdown modes; Top opportunities is a cost / margin view. */
export function breakdownModesFor<T extends { value: string }>(modes: readonly T[], canViewMoney: boolean): T[] {
  return canViewMoney ? [...modes] : modes.filter((mode) => mode.value !== 'opportunities');
}
