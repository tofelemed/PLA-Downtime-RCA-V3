import { useInfiniteQuery, type InfiniteData, type QueryKey } from '@tanstack/react-query';
import { v2Request } from '../client';
import type { RcaPortfolioQuery, RcaPortfolioView } from '../types/rca-portfolio';
import { sameTenantQuery } from './placeholder';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { stabilizeWindowParams } from './time-window';
import { useV2TenantId } from './use-v2-tenant';

/**
 * Loss → cause → action → outcome portfolio (item 2.1, `GET /reports/rca-portfolio`): keyset pages of the
 * server's rows ("Show more" loads the next page). Keyed under the RCA cases so a case, cause or action
 * change refreshes it; the window bounds are minute-stable.
 */
export function useRcaPortfolio(query: RcaPortfolioQuery) {
  const tenantId = useV2TenantId();
  const enabled = Boolean(tenantId);
  const stable = stabilizeWindowParams(query);
  return useInfiniteQuery<RcaPortfolioView, Error, InfiniteData<RcaPortfolioView, string | null>, QueryKey, string | null>({
    queryKey: v2Keys.list(tenantId ?? '-', 'rca-cases', { filters: { kind: 'portfolio', ...stable } }),
    enabled,
    initialPageParam: null,
    staleTime: STALE_TIME['rca-cases'],
    refetchOnWindowFocus: false,
    placeholderData: (previous, previousQuery) => (enabled && sameTenantQuery(tenantId, previousQuery) ? previous : undefined),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? null,
    queryFn: async ({ pageParam, signal }) =>
      (
        await v2Request<RcaPortfolioView>({
          method: 'GET',
          path: '/reports/rca-portfolio',
          query: { ...stable, cursor: pageParam ?? undefined },
          signal,
        })
      ).data,
  });
}
