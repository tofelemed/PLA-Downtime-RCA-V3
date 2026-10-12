import { useQuery } from '@tanstack/react-query';
import { v2Request } from '../client';
import type { ActivitySummaryResponse } from '../types/activity-summary';
import { sameTenantQuery } from './placeholder';
import { v2Keys } from './query-keys';
import { stabilizeWindowParams } from './time-window';
import { useV2TenantId } from './use-v2-tenant';

const MINUTE = 60_000;

/**
 * Work items (RCA cases, tasks) and audit activity created in a window — counted on the server
 * (`GET /v2/reports/activity-summary`). Fresh for a minute; the previous window stays while a new one loads.
 */
export function useActivitySummary(window: { from: string; to: string } | null) {
  const tenantId = useV2TenantId();
  const enabled = Boolean(tenantId && window);
  const query = window ? stabilizeWindowParams(window) : null;
  return useQuery<ActivitySummaryResponse>({
    queryKey: v2Keys.list(tenantId ?? '-', 'reports', { window: query, filters: { kind: 'activity-summary' } }),
    enabled,
    staleTime: MINUTE,
    refetchOnWindowFocus: false,
    placeholderData: (previous, previousQuery) => (enabled && sameTenantQuery(tenantId, previousQuery) ? previous : undefined),
    queryFn: async ({ signal }) =>
      (await v2Request<ActivitySummaryResponse>({ method: 'GET', path: '/reports/activity-summary', query: query ?? {}, signal })).data,
  });
}
