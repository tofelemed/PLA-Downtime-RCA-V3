import { useEffect, useMemo } from 'react';
import { flattenPages, useV2InfiniteList } from './use-v2-list';

/** What screens outside master data need of an asset (`GET /v2/assets` item). */
export interface AssetSummary {
  id: string;
  code: string;
  name: string;
  unitId: string;
  /** asset type as maintained in master data (selects the equipment class of the failure dictionary) */
  assetType?: string | null;
  retiredAt: string | null;
}

/**
 * The acting plant's asset directory from `GET /v2/assets` (FE-09): every keyset page of 500 is read
 * (retired assets included, so old events keep their names), sorted by name, one cache for every screen.
 */
export function useAssetDirectory() {
  const query = useV2InfiniteList<AssetSummary>({
    resource: 'assets',
    path: '/assets',
    query: { limit: 500, status: 'all', sort: 'name' },
    key: { filters: { directory: true } },
  });
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  useEffect(() => {
    // several screens share the directory: a running page request is joined, not restarted
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage({ cancelRefetch: false });
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const assets = useMemo(() => flattenPages(query.data?.pages), [query.data]);
  return { assets, isLoading: query.isLoading || Boolean(hasNextPage), error: query.error };
}
