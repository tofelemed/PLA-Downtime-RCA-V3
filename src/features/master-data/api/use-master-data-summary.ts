import { useQuery } from '@tanstack/react-query';
import { v2Request } from '@/api/v2/client';
import { v2Keys } from '@/api/v2/queries/query-keys';
import { STALE_TIME } from '@/api/v2/queries/stale-times';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { MasterDataSummaryView } from './master-data-types';

/** Active record counts of the acting plant (overview cards); refreshed by every master-data write. */
export function useMasterDataSummary() {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'master-data', 'summary'),
    enabled: Boolean(tenantId),
    staleTime: STALE_TIME['master-data'],
    queryFn: async ({ signal }) =>
      (await v2Request<MasterDataSummaryView>({ method: 'GET', path: '/master-data/summary', signal })).data,
  });
}
