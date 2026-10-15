import { useQuery } from '@tanstack/react-query';
import type { QueryOf } from '../schema-types';
import type { ListResponse } from '../types/envelopes';
import type { LotDispositionView } from '../types/periods';
import { v2 } from '../v2';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { useV2TenantId } from './use-v2-tenant';

export type LotDispositionFilters = QueryOf<'/api/v2/lot-dispositions', 'get'>;

/** Most dispositions a period view lists (a shift has a handful of lots). */
const PAGE = 200;

/**
 * SME E3: lot dispositions of a unit whose production interval overlaps a window. Cached with the period
 * it belongs to (`production-periods`), so a disposition approval refreshes the period and its list.
 */
export function useLotDispositions(filters: LotDispositionFilters | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'production-periods', 'lot-dispositions', JSON.stringify(filters ?? {})),
    enabled: Boolean(tenantId && filters?.unitId),
    staleTime: STALE_TIME['production-periods'],
    queryFn: async ({ signal }) =>
      (await v2.get<ListResponse<LotDispositionView>, '/api/v2/lot-dispositions'>('/api/v2/lot-dispositions', {
        query: { limit: PAGE, ...filters },
        signal,
      })).data,
  });
}
