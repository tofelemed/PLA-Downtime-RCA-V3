import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { v2Request } from '@/api/v2/client';
import type { QueryParams } from '@/api/v2/request-url';
import { v2Keys } from '@/api/v2/queries/query-keys';
import { STALE_TIME } from '@/api/v2/queries/stale-times';
import { usePagedQuery } from '@/api/v2/queries/use-paged-query';
import { flattenPages, useV2InfiniteList } from '@/api/v2/queries/use-v2-list';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { RecordResource } from './record-resource';

const detailKey = (tenantId: string | null, source: RecordResource, id: string) =>
  v2Keys.detail(tenantId ?? '-', source.resource, id, source.path);

async function fetchRecord<T>(source: RecordResource, id: string, signal?: AbortSignal): Promise<T> {
  return (await v2Request<T>({ method: 'GET', path: `${source.path}/${id}`, signal })).data;
}

/** A server-paged list of 20 rows per page (keyset), filters in the key so Back restores the page. */
export function useRecordPage<T>(source: RecordResource, query: QueryParams) {
  return usePagedQuery<T>({
    resource: source.resource,
    path: source.path,
    query,
    key: { filters: { kind: source.path, ...query } },
  });
}

/**
 * Every record of a small lookup list (pickers: units of the plant, active checklists), following
 * `nextCursor` so nothing is cut off silently.
 */
export function useRecordLookup<T>(source: RecordResource, query: QueryParams, enabled = true) {
  const list = useV2InfiniteList<T>({
    resource: source.resource,
    path: source.path,
    query: { limit: 500, ...query },
    key: { filters: { kind: source.path, lookup: true, ...query } },
    enabled,
  });
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  return { ...list, items: flattenPages(list.data?.pages), complete: list.data !== undefined && !hasNextPage };
}

/** One record (with its row version for If-Match); disabled for `null` (a new record). */
export function useRecordDetail<T>(source: RecordResource, id: string | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: detailKey(tenantId, source, id ?? '-'),
    enabled: Boolean(tenantId && id),
    staleTime: STALE_TIME[source.resource],
    queryFn: ({ signal }) => fetchRecord<T>(source, id as string, signal),
  });
}

/** Warms the detail cache when a row is hovered or focused, so the detail page opens without a spinner. */
export function usePrefetchRecord(source: RecordResource) {
  const tenantId = useV2TenantId();
  const queryClient = useQueryClient();
  return useCallback(
    (id: string) => {
      if (!tenantId) return;
      void queryClient.prefetchQuery({
        queryKey: detailKey(tenantId, source, id),
        staleTime: STALE_TIME[source.resource],
        queryFn: ({ signal }) => fetchRecord(source, id, signal),
      });
    },
    [queryClient, source, tenantId],
  );
}
