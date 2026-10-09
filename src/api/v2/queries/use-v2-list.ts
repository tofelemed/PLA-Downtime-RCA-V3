import { useInfiniteQuery } from '@tanstack/react-query';
import { v2Request } from '../client';
import type { QueryParams } from '../request-url';
import type { ListResponse } from '../types/envelopes';
import { V2ListParts, V2Resource, v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { useV2TenantId } from './use-v2-tenant';

export interface V2ListOptions {
  resource: V2Resource;
  /** path relative to the v2 base, e.g. `/production-events` */
  path: string;
  /** server-side filters and paging size (never filtered in the browser) */
  query: QueryParams;
  key: V2ListParts;
  enabled?: boolean;
  /** periodic refetch in ms (e.g. running stops, whose elapsed time the server computes) */
  refetchInterval?: number;
}

/**
 * Keyset-paged v2 list as an infinite query (plan 3.1, API01): each page carries the server's
 * `nextCursor`; filters and the window are part of the key, so a change starts a new list.
 */
export function useV2InfiniteList<TItem>(options: V2ListOptions) {
  const tenantId = useV2TenantId();
  return useInfiniteQuery({
    queryKey: v2Keys.list(tenantId ?? '-', options.resource, options.key),
    enabled: Boolean(tenantId) && options.enabled !== false,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const response = await v2Request<ListResponse<TItem>>({
        method: 'GET',
        path: options.path,
        query: { ...options.query, cursor: pageParam ?? undefined },
        signal,
      });
      return response.data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? null,
    staleTime: STALE_TIME[options.resource],
    refetchInterval: options.refetchInterval,
  });
}

/** Items of every loaded page, in server order. */
export function flattenPages<TItem>(pages: ReadonlyArray<ListResponse<TItem>> | undefined): TItem[] {
  return (pages ?? []).flatMap((page) => page.items);
}
