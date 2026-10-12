import type { QueryClient } from '@tanstack/react-query';
import { v2Request } from '@/api/v2/client';
import type { QueryParams } from '@/api/v2/request-url';
import { reportKey, type ReportKind, type ReportQueryBase } from '@/api/v2/queries/reports';
import { STALE_TIME } from '@/api/v2/queries/stale-times';
import { stabilizeWindowParams } from '@/api/v2/queries/time-window';
import { lossTreeQuery, oeeQuery, statusQuery, trendQuery, waterfallQuery, type AnalyticsScope, type PlaTab } from './analytics-scope';

type Read = [kind: ReportKind, query: ReportQueryBase];

/** The first report each PLA view reads (the same query objects the views send, so the keys match). */
export function firstReadsOf(tab: PlaTab, scope: AnalyticsScope): Read[] {
  switch (tab) {
    case 'waterfall':
      return [['scope-waterfall', waterfallQuery(scope)]];
    case 'losses':
      return [['loss-tree', lossTreeQuery(scope)]];
    case 'trends':
      return [
        ['oee', oeeQuery(scope, scope.trendBy)],
        ['reconciliation-trend', trendQuery(scope)],
      ];
    case 'reconciliation':
      return [['reconciliation-status', statusQuery(scope)]];
    case 'oee':
      return [
        ['oee', oeeQuery(scope, 'unit', 'operational')],
        ['oee', oeeQuery(scope, 'unit', 'reconciled')],
      ];
  }
}

/**
 * Warms the cache of a view before it is opened (tab hover / focus): the same key and request as
 * `useReport`, so opening the view shows the figures at once. Cached reports are not fetched again.
 */
export function prefetchView(client: QueryClient, input: { tenantId: string | null; tab: PlaTab; scope: AnalyticsScope; tz: string }): void {
  if (!input.tenantId) return;
  for (const [kind, query] of firstReadsOf(input.tab, input.scope)) {
    void client.prefetchQuery({
      queryKey: reportKey(input.tenantId, kind, query, input.tz),
      staleTime: STALE_TIME.reports,
      queryFn: async ({ signal }) =>
        (await v2Request({ method: 'GET', path: `/reports/${kind}`, query: stabilizeWindowParams(query) as unknown as QueryParams, signal })).data,
    });
  }
}
