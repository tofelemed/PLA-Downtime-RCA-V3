import { useQuery } from '@tanstack/react-query';
import { v2Request } from '../client';
import type { QueryParams } from '../request-url';
import type { CapacityGapQuery, CapacityGapReportView } from '../types/capacity-gap';
import { sameTenantQuery } from './placeholder';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { useV2TenantId } from './use-v2-tenant';

/**
 * Capacity gap report (`GET /reports/capacity-gap`, plan 1.2): approved rate kinds side by side with the
 * server's gaps and ratios. Keyed under `profiles`, so a profile or rate change refreshes it.
 */
export function useCapacityGapReport(query: CapacityGapQuery) {
  const tenantId = useV2TenantId();
  const { unitIds, ...filters } = query;
  return useQuery<CapacityGapReportView>({
    queryKey: v2Keys.list(tenantId ?? '-', 'profiles', { scope: { unitIds }, filters: { kind: 'capacity-gap', ...filters } }),
    enabled: Boolean(tenantId),
    staleTime: STALE_TIME.profiles,
    refetchOnWindowFocus: false,
    placeholderData: (previous, previousQuery) => (sameTenantQuery(tenantId, previousQuery) ? previous : undefined),
    queryFn: async ({ signal }) =>
      (await v2Request<CapacityGapReportView>({ method: 'GET', path: '/reports/capacity-gap', query: query as unknown as QueryParams, signal })).data,
  });
}
