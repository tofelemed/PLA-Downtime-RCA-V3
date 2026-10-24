import type { AnalyticsScope } from '../model/analytics-scope';
import { dashboardScope, presetOfLabel, type DashboardNode } from '../model/dashboard-scope';

const SHORT_PERIODS: readonly string[] = ['24h', '7d', '30d'];

export const RELIABILITY_SUBTITLE = 'monthly';
export const RELIABILITY_SHORT_SUBTITLE = 'monthly · last 6 months';
export const FALLING_MTBF_CHIP = 'MTBF falling 3 months in a row';

/**
 * The scope of the reliability trend: the dashboard's own for 3 months or more, the same node over the last
 * 6 months for a shorter period, ending where the dashboard window ends (so both move on together).
 */
export function reliabilityScope(scope: AnalyticsScope, node: DashboardNode): { scope: AnalyticsScope; subtitle: string } {
  const key = presetOfLabel(scope.windowLabel)?.key;
  if (key === undefined || !SHORT_PERIODS.includes(key)) return { scope, subtitle: RELIABILITY_SUBTITLE };
  return { scope: dashboardScope('6m', node, Date.parse(scope.to)), subtitle: RELIABILITY_SHORT_SUBTITLE };
}
