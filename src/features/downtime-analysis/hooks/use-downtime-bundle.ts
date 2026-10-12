import { useQuery } from '@tanstack/react-query';
import { v2Request } from '@/api/v2/client';
import { sameTenantQuery } from '@/api/v2/queries/placeholder';
import { v2Keys } from '@/api/v2/queries/query-keys';
import { STALE_TIME } from '@/api/v2/queries/stale-times';
import { stabilizeWindowParams } from '@/api/v2/queries/time-window';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { QueryParams } from '@/api/v2/request-url';
import type { AnalyticsResponse } from '@/api/v2/types/envelopes';
import type { DowntimeBundleData, DowntimeBundleQuery } from '../model/bundle-views';

/**
 * The page snapshot (T24): summary tiles, bad actors, crews and the trend series from ONE
 * `GET /reports/downtime-bundle` — one run selection, one request instead of eight. Cached like every
 * report: the previous result stays while filters change, no refetch on window focus.
 */
export function useDowntimeBundle(query: DowntimeBundleQuery, tz?: string) {
  const tenantId = useV2TenantId();
  const { from, to, unitIds, approvedOnly, ...filters } = query;
  return useQuery<AnalyticsResponse<DowntimeBundleData>>({
    queryKey: v2Keys.list(tenantId ?? '-', 'reports', {
      scope: { unitIds },
      window: { from, to, tz },
      filters: { kind: 'downtime-bundle', ...filters },
      revisionSelector: approvedOnly ? 'approved' : 'shown',
    }),
    enabled: Boolean(tenantId),
    staleTime: STALE_TIME.reports,
    refetchOnWindowFocus: false,
    placeholderData: (previous, previousQuery) => (sameTenantQuery(tenantId, previousQuery) ? previous : undefined),
    queryFn: async ({ signal }) =>
      (
        await v2Request<AnalyticsResponse<DowntimeBundleData>>({
          method: 'GET',
          path: '/reports/downtime-bundle',
          query: stabilizeWindowParams(query) as unknown as QueryParams,
          signal,
        })
      ).data,
  });
}

export type DowntimeBundleResult = ReturnType<typeof useDowntimeBundle>;
