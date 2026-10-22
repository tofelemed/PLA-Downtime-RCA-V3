import { useEffect, useMemo } from 'react';
import { flattenPages, useV2InfiniteList, type V2ListOptions } from './use-v2-list';

/**
 * Every row of a small keyset list that feeds a picker (approved routes with a buffer, approved streams of a
 * unit), following `nextCursor` so nothing is cut off silently. The table of the same records pages on its
 * own (`usePagedQuery`); this list is never shown as a table.
 */
export function useV2Lookup<TItem>(options: V2ListOptions<TItem>) {
  const list = useV2InfiniteList<TItem>({ ...options, key: { ...options.key, filters: { ...options.key.filters, lookup: true } } });
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage({ cancelRefetch: false });
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const items = useMemo(() => flattenPages(list.data?.pages), [list.data]);
  return { items, complete: list.data !== undefined && !hasNextPage, isLoading: list.isLoading };
}
