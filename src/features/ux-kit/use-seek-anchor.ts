import { useEffect } from 'react';
import type { AnchorFocus } from './use-anchor-focus';

/** What a list knows about its loaded rows. */
export interface AnchorListState {
  /** ids of the rows loaded so far */
  ids: readonly string[];
  /** the server has more pages */
  hasMore: boolean;
  /** the list is loaded and not refetching (never seek on placeholder rows) */
  settled: boolean;
}

/** Whether the linked row must be sought on the server: missing from the loaded rows while more pages exist. */
export function shouldSeek(anchor: Pick<AnchorFocus, 'anchorId' | 'focus'>, list: AnchorListState): boolean {
  return Boolean(anchor.anchorId) && anchor.focus === undefined && list.settled && list.hasMore && !list.ids.includes(anchor.anchorId ?? '');
}

/** Calls `anchor.seek()` once the linked row is known to be on a later page (see `useAnchorFocus`). */
export function useSeekAnchor(anchor: AnchorFocus, list: AnchorListState): void {
  const seek = shouldSeek(anchor, list);
  const { seek: start } = anchor;
  useEffect(() => {
    if (seek) start();
  }, [seek, start]);
}

interface ListQueryFacts {
  isSuccess: boolean;
  isFetching: boolean;
}

/** `AnchorListState` of a one-page list query (`{ items, nextCursor }`). */
export function pageListState(query: ListQueryFacts & { data?: { items: ReadonlyArray<{ id: string }>; nextCursor?: string | null } }): AnchorListState {
  const items = query.data?.items ?? [];
  return { ids: items.map((item) => item.id), hasMore: Boolean(query.data?.nextCursor), settled: query.isSuccess && !query.isFetching };
}

/** `AnchorListState` of a keyset infinite list (`useV2InfiniteList`). */
export function infiniteListState(
  query: ListQueryFacts & { hasNextPage: boolean; data?: { pages: ReadonlyArray<{ items: ReadonlyArray<{ id: string }> }> } },
): AnchorListState {
  const ids = (query.data?.pages ?? []).flatMap((page) => page.items.map((item) => item.id));
  return { ids, hasMore: query.hasNextPage, settled: query.isSuccess && !query.isFetching };
}
