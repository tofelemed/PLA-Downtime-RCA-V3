import { useQuery } from '@tanstack/react-query';
import { v2Request } from '../client';
import type { ListResponse } from '../types/envelopes';
import type { ReversibleLineView } from '../types/reconciliation';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { useV2TenantId } from './use-v2-tenant';

/**
 * SME R9: the newest 100 approved lines of the unit's earlier periods a reversal of this period may name,
 * with what is left to reverse (server keyset; the editor picks from the first page).
 */
export function useReversibleLines(periodId: string | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'period-accounting', periodId ?? '-', 'reversible-lines'),
    enabled: Boolean(tenantId && periodId),
    staleTime: STALE_TIME['period-accounting'],
    queryFn: async ({ signal }) =>
      (await v2Request<ListResponse<ReversibleLineView>>({ method: 'GET', path: `/production-periods/${periodId}/reversible-lines`, query: { limit: 100 }, signal })).data,
  });
}
