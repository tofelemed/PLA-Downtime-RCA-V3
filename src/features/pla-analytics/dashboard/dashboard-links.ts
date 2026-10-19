import { withAnalysisContext, type AnalysisContext } from '@/features/analysis-navigation/analysis-context';
import { relativeWindowOf } from '@/features/event-hub/model/relative-window';
import type { AnalyticsScope } from '../model/analytics-scope';

/**
 * Deep links of the dashboard tiles (UX audit G-6 / B-8): every analysis target opens with the
 * dashboard's analysis context (`analysis-context.ts`), plus the tile's own filter.
 */

/**
 * The dashboard's analysis context: its window is always a rolling preset, so links carry the preset
 * key and the target resolves it at its own "now"; `units` when the scope names any. Approved-only is
 * not carried (the dashboard has no such choice), so each target keeps its own default.
 */
export function dashboardContext(scope: AnalyticsScope): AnalysisContext {
  const rolling = relativeWindowOf(scope.windowLabel);
  const window = rolling ? { relativeWindow: rolling.key } : { from: scope.from, to: scope.to, windowLabel: scope.windowLabel };
  return scope.unitIds.length > 0 ? { ...window, unitIds: scope.unitIds } : window;
}

/** Downtime Analysis overview over the dashboard window. */
export function downtimeHref(scope: AnalyticsScope): string {
  return withAnalysisContext('/downtime', dashboardContext(scope));
}

/** Event Hub over the dashboard window, optionally filtered (Event Hub URL names, e.g. `assets`, `kinds`). */
export function eventsHref(scope: AnalyticsScope, filters: Readonly<Record<string, string>> = {}): string {
  const own = new URLSearchParams(filters);
  return withAnalysisContext(own.size > 0 ? `/events?${own}` : '/events', dashboardContext(scope));
}

/** The downtime stops of one asset in the window (a "most stopped assets" row). */
export function assetStopsHref(scope: AnalyticsScope, assetId: string): string {
  return eventsHref(scope, { assets: assetId, kinds: 'downtime' });
}

/** The uncoded stops of the window (Event Hub "To code"). */
export function stopsToCodeHref(scope: AnalyticsScope): string {
  return eventsHref(scope, { kinds: 'downtime', coding: 'uncoded' });
}

/**
 * A routed PLA page with the dashboard context and the page's own parameters, e.g.
 * `/pla-analytics/losses?breakdown=repeat-causes` (the page reads `breakdown`, never a hash — QA PLA M4).
 */
export function plaHref(scope: AnalyticsScope, path: string, own: Readonly<Record<string, string>> = {}): string {
  const params = new URLSearchParams(own);
  return withAnalysisContext(params.size > 0 ? `${path}?${params}` : path, dashboardContext(scope));
}

/** Reports with the dashboard context, optionally on one view (`?view=`). */
export function reportsHref(scope: AnalyticsScope, view?: string): string {
  return withAnalysisContext(view ? `/reports?view=${encodeURIComponent(view)}` : '/reports', dashboardContext(scope));
}

/**
 * RCA list filters (`rca/model/case-filters.ts`, RCA tabs): investigations and actions are not windowed.
 * "Open critical" is exact (open and Critical, `GET /v2/rcas?open=true`). The Actions tab lists the
 * caller's own actions unless `mine=false`, so the scope-wide overdue count opens it with `mine=false`
 * and "My overdue actions" without.
 */
export const RCA_LIST_LINKS = {
  all: '/rca',
  open: '/rca?open=true',
  overdue: '/rca?due=overdue',
  critical: '/rca?open=true&priority=Critical',
  overdueActions: '/rca?tab=actions&mine=false&overdue=true',
  myOverdueActions: '/rca?tab=actions&overdue=true',
  recommended: '/rca?tab=recommended',
} as const;
