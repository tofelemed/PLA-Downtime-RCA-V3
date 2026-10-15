import { useQuery } from '@tanstack/react-query';
import { v2Request } from '../client';
import type { QueryParams } from '../request-url';
import type { QueryOf } from '../schema-types';
import type { BadActorReportView } from '../types/bad-actors';
import type { AnalyticsResponse } from '../types/envelopes';
import { sameTenantQuery } from './placeholder';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { useV2TenantId } from './use-v2-tenant';

export type BadActorQuery = QueryOf<'/api/v2/reports/bad-actors', 'get'>;

/**
 * CA8 monthly bad-actor review (`GET /reports/bad-actors`): ranked on the server over the RCA policy's
 * rolling window ending at the month end; tenant and units from identity. null query = idle.
 */
export function useBadActorReport(query: BadActorQuery | null) {
  const tenantId = useV2TenantId();
  const enabled = Boolean(tenantId && query);
  const { unitIds, ...filters } = query ?? { month: '' };
  return useQuery<AnalyticsResponse<BadActorReportView>>({
    queryKey: v2Keys.list(tenantId ?? '-', 'reports', { scope: { unitIds }, filters: { kind: 'bad-actors', ...filters } }),
    enabled,
    staleTime: STALE_TIME.reports,
    refetchOnWindowFocus: false,
    placeholderData: (previous, previousQuery) => (enabled && sameTenantQuery(tenantId, previousQuery) ? previous : undefined),
    queryFn: async ({ signal }) =>
      (await v2Request<AnalyticsResponse<BadActorReportView>>({
        method: 'GET',
        path: '/reports/bad-actors',
        query: (query ?? {}) as unknown as QueryParams,
        signal,
      })).data,
  });
}
