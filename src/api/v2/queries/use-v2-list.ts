import { useInfiniteQuery, type InfiniteData, type QueryKey } from '@tanstack/react-query';
import { v2Request } from '../client';
import type { QueryParams } from '../request-url';
import type { ListResponse } from '../types/envelopes';
import { sameTenantQuery } from './placeholder';
import { V2ListParts, V2Resource, v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { stabilizeWindowParams } from './time-window';
import { useV2TenantId } from './use-v2-tenant';

/** Poll interval as a number, or computed from the loaded pages (`false` stops polling). */
export type ListRefetchInterval<TItem> =
  | number
  | false
  | ((pages: ReadonlyArray<ListResponse<TItem>> | undefined) => number | false);

export interface V2ListOptions<TItem = unknown> {
  resource: V2Resource;
  /** path relative to the v2 base, e.g. `/production-events` */
  path: string;
  /** server-side filters and paging size (never filtered in the browser) */
  query: QueryParams;
  key: V2ListParts;
  enabled?: boolean;
  /** periodic refetch (e.g. running stops); never while the tab is hidden */
  refetchInterval?: ListRefetchInterval<TItem>;
}

/**
 * Keyset-paged v2 list as an infinite query (plan 3.1, API01): each page carries the server's
 * `nextCursor`; filters and the window are part of the key, so a change starts a new list. While the
 * new list loads, the previous one of the same tenant stays on screen (`isPlaceholderData`), and the
 * window bounds are minute-stable (time-window.ts) so revisits hit the cache.
 */
export function useV2InfiniteList<TItem>(options: V2ListOptions<TItem>) {
  const tenantId = useV2TenantId();
  const enabled = Boolean(tenantId) && options.enabled !== false;
  const interval = options.refetchInterval;
  return useInfiniteQuery<ListResponse<TItem>, Error, InfiniteData<ListResponse<TItem>, string | null>, QueryKey, string | null>({
    queryKey: v2Keys.list(tenantId ?? '-', options.resource, options.key),
    enabled,
    initialPageParam: null,
    queryFn: async ({ pageParam, signal }) => {
      const response = await v2Request<ListResponse<TItem>>({
        method: 'GET',
        path: options.path,
        query: { ...stabilizeWindowParams(options.query), cursor: pageParam ?? undefined },
        signal,
      });
      return response.data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? null,
    staleTime: STALE_TIME[options.resource],
    placeholderData: (previous, previousQuery) => (enabled && sameTenantQuery(tenantId, previousQuery) ? previous : undefined),
    refetchInterval: typeof interval === 'function' ? (query) => interval(query.state.data?.pages) : interval,
    refetchIntervalInBackground: false,
  });
}

/** Items of every loaded page, in server order. */
export function flattenPages<TItem>(pages: ReadonlyArray<ListResponse<TItem>> | undefined): TItem[] {
  return (pages ?? []).flatMap((page) => page.items);
}
