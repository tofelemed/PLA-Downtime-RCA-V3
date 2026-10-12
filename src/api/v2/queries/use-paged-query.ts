import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, rangeOf, type PagerModel } from '@/features/ux-kit/data-table/pager-model';
import { stableKeyOf } from '@/features/ux-kit/data-table/stable-key';
import { useResettableIndex } from '@/features/ux-kit/data-table/use-resettable-index';
import type { ListResponse } from '../types/envelopes';
import { flattenPages, useV2InfiniteList, type V2ListOptions } from './use-v2-list';

export interface PagedQueryOptions extends V2ListOptions {
  /** rows per server page = rows per pager page; default 20 */
  pageSize?: number;
  /** `pages` (default): First / Previous / Next; `append`: one growing list with "Show more" */
  mode?: 'pages' | 'append';
}

export interface PagedQueryStatus {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  /** a newer page or filter result is loading while the previous rows stay on screen */
  isRefreshing: boolean;
}

type InfiniteList<T> = ReturnType<typeof useV2InfiniteList<T>>;

export interface PagedQueryResult<T> {
  rows: T[];
  pager: PagerModel;
  status: PagedQueryStatus;
  query: InfiniteList<T>;
}

interface PagerInput<T> {
  query: InfiniteList<T>;
  pages: ReadonlyArray<ListResponse<T>>;
  pageIndex: number;
  pageSize: number;
  setIndex: (update: (index: number) => number) => void;
  setPageSize: (size: number) => void;
  next: () => void;
}

const countRows = <T,>(pages: ReadonlyArray<ListResponse<T>>) => pages.reduce((sum, page) => sum + page.items.length, 0);

function buildPagesPager<T>({ query, pages, pageIndex, pageSize, setIndex, setPageSize, next }: PagerInput<T>): PagerModel {
  const loaded = pages.length;
  const complete = query.data !== undefined && !query.hasNextPage;
  return {
    pageIndex,
    pageSize,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    setPageSize,
    canPrevious: pageIndex > 0,
    canNext: pageIndex < loaded - 1 || query.hasNextPage,
    previous: () => setIndex((index) => index - 1),
    next,
    first: () => setIndex(() => 0),
    goTo: (target) => setIndex(() => Math.min(Math.max(0, loaded - 1), target)),
    pageCount: complete ? Math.max(1, loaded) : null,
    totalCount: complete ? countRows(pages) : null,
    ...rangeOf(countRows(pages.slice(0, pageIndex)), pages[pageIndex]?.items.length ?? 0),
    isFetchingPage: query.isFetchingNextPage,
    mode: 'pages',
  };
}

function buildAppendPager<T>({ query, pages, pageSize, setPageSize }: PagerInput<T>): PagerModel {
  const shown = countRows(pages);
  return {
    pageIndex: 0,
    pageSize,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    setPageSize,
    canPrevious: false,
    canNext: false,
    previous: () => undefined,
    next: () => undefined,
    first: () => undefined,
    pageCount: null,
    totalCount: query.data !== undefined && !query.hasNextPage ? shown : null,
    ...rangeOf(0, shown),
    isFetchingPage: query.isFetchingNextPage,
    mode: 'append',
    loadMore: () => void query.fetchNextPage(),
    hasMore: query.hasNextPage,
  };
}

/** "Next" that stays on cached pages and fetches the following keyset page only at the end. */
function useNextPage<T>(query: InfiniteList<T>, pageIndex: number, identity: string, setIndex: PagerInput<T>['setIndex']) {
  const identityRef = useRef(identity);
  useEffect(() => {
    identityRef.current = identity;
  }, [identity]);
  const loaded = query.data?.pages.length ?? 0;
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  return useCallback(() => {
    const from = pageIndex;
    if (from < loaded - 1) return setIndex(() => from + 1);
    if (!hasNextPage || isFetchingNextPage) return;
    const startedFor = identityRef.current;
    void fetchNextPage().then((result) => {
      const pagesNow = result.data?.pages.length ?? 0;
      if (identityRef.current !== startedFor || pagesNow <= from + 1) return;
      setIndex((index) => (index === from ? from + 1 : index));
    });
  }, [pageIndex, loaded, hasNextPage, isFetchingNextPage, fetchNextPage, setIndex]);
}

/**
 * A v2 keyset list as pages of 20 (docs/UI_UX_AUDIT.md §3): one pager page = one server page
 * (`limit = pageSize`), Next past the last cached page fetches the next cursor, Previous reads the
 * cache. The page returns to 1 whenever resource, path, key or query change, and when the page size
 * changes. v2 lists carry no total, so the count shows once the last page is loaded.
 *
 * @example
 * const { rows, pager, status } = usePagedQuery<EventView>({ resource: 'production-events',
 *   path: '/production-events', query: { unitId }, key: { scope: { unitIds: [unitId] }, filters: { q } } });
 * return <DataTable caption="Events" columns={columns} rows={rows} pager={pager} status={status} getRowKey={(e) => e.id} />;
 */
export function usePagedQuery<T>(options: PagedQueryOptions): PagedQueryResult<T> {
  const { pageSize: initialSize, mode = 'pages', ...list } = options;
  const [pageSize, setPageSize] = useState(initialSize ?? DEFAULT_PAGE_SIZE);
  const query = useV2InfiniteList<T>({
    ...list,
    query: { ...list.query, limit: pageSize },
    key: { ...list.key, filters: { ...list.key.filters, pageSize } },
  });
  const identity = stableKeyOf([list.resource, list.path, list.key, list.query, pageSize]);
  const [pageIndex, setIndex] = useResettableIndex(identity);
  const next = useNextPage(query, pageIndex, identity, setIndex);
  const pages = useMemo(() => query.data?.pages ?? [], [query.data]);
  const input = { query, pages, pageIndex, pageSize, setIndex, setPageSize, next };
  const pager = mode === 'append' ? buildAppendPager(input) : buildPagesPager(input);
  const rows = useMemo(() => (mode === 'append' ? flattenPages(pages) : pages[pageIndex]?.items ?? []), [mode, pages, pageIndex]);
  const status: PagedQueryStatus = {
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    onRetry: () => void query.refetch(),
    isRefreshing: (query.isFetching && !query.isLoading && !query.isFetchingNextPage) || query.isPlaceholderData,
  };
  return { rows, pager, status, query };
}
