import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, rangeOf, type PagerModel } from '@/features/ux-kit/data-table/pager-model';
import { stableKeyOf } from '@/features/ux-kit/data-table/stable-key';
import type { QueryParams } from '../request-url';
import type { GridWorkflowState, PeriodSummaryView, ResidualState, RevisionSelector } from '../types/period-overview';
import type { PagedQueryStatus } from './use-paged-query';
import { flattenPages, useV2InfiniteList } from './use-v2-list';

/** `GET /period-summaries` filters (server overlap semantics on `[from, to)`; no unit = the caller's scope). */
export interface PeriodSummaryListQuery {
  unitIds?: string[];
  from: string;
  to: string;
  workflowState?: GridWorkflowState[];
  residualStates?: ResidualState[];
  view?: RevisionSelector;
  sort?: 'utcStart' | '-utcStart';
}

/** Server pages fetched automatically per "fill" before the list waits for "Show more". */
export const FILL_FETCH_BUDGET = 5;

export interface FillInput {
  rows: number;
  target: number;
  hasNextPage: boolean;
  busy: boolean;
  /** server pages fetched since the current fill started */
  fetchedThisFill: number;
}

/**
 * Whether to fetch the next keyset page now. A residual-filtered page may hold fewer rows than `limit` (even
 * none) while `nextCursor` is set, so a short page is never the end: keep paging until the target is
 * reached, the cursor is null, or the budget of one fill is spent (never while nothing is shown yet, so an
 * empty list always means "no match").
 */
export function shouldFetchMore({ rows, target, hasNextPage, busy, fetchedThisFill }: FillInput): boolean {
  if (!hasNextPage || busy || rows >= target) return false;
  return rows === 0 || fetchedThisFill < FILL_FETCH_BUDGET;
}

interface FillState {
  identity: string;
  target: number;
  startPages: number;
}

function cleanQuery(query: PeriodSummaryListQuery): QueryParams {
  const params: Record<string, unknown> = { from: query.from, to: query.to };
  if (query.unitIds?.length) params.unitIds = query.unitIds;
  if (query.workflowState?.length) params.workflowState = query.workflowState;
  if (query.residualStates?.length) params.residualStates = query.residualStates;
  if (query.view) params.view = query.view;
  if (query.sort) params.sort = query.sort;
  return params as QueryParams;
}

export interface PeriodSummaryListResult {
  rows: PeriodSummaryView[];
  pager: PagerModel;
  status: PagedQueryStatus;
}

type FillSetter = (update: (state: FillState) => FillState) => void;

/** The fill target and the page count it started at; back to one page whenever the list identity changes. */
function useFill(identity: string, pageSize: number): [FillState, FillSetter] {
  const [fill, setFill] = useState<FillState>({ identity, target: pageSize, startPages: 0 });
  const current = fill.identity === identity ? fill : { identity, target: pageSize, startPages: 0 };
  if (fill.identity !== identity) setFill(current);
  return [current, setFill];
}

interface AppendPagerInput {
  shown: number;
  pageSize: number;
  setPageSize: (size: number) => void;
  complete: boolean;
  isFetchingPage: boolean;
  loadMore: () => void;
  hasMore: boolean;
}

function appendPager({ shown, pageSize, setPageSize, complete, isFetchingPage, loadMore, hasMore }: AppendPagerInput): PagerModel {
  const none = () => undefined;
  return {
    pageIndex: 0,
    pageSize,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    setPageSize,
    canPrevious: false,
    canNext: false,
    previous: none,
    next: none,
    first: none,
    pageCount: null,
    totalCount: complete ? shown : null,
    ...rangeOf(0, shown),
    isFetchingPage,
    mode: 'append',
    loadMore,
    hasMore,
  };
}

/**
 * A growing period list ("Show more") that fills each step with `pageSize` rows across as many keyset pages
 * as needed, for residual-filtered and cross-plan lists (UX D-5 / D-6). The empty state shows only once the
 * server says there is nothing more.
 */
export function usePeriodSummaryList(query: PeriodSummaryListQuery, kind: string): PeriodSummaryListResult {
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const params = cleanQuery(query);
  const { workflowState, residualStates, view, sort } = query;
  const list = useV2InfiniteList<PeriodSummaryView>({
    resource: 'period-accounting',
    path: '/period-summaries',
    query: { ...params, limit: pageSize },
    key: { scope: { unitIds: query.unitIds ?? [] }, window: { from: query.from, to: query.to }, filters: { kind, workflowState, residualStates, view, sort, pageSize } },
  });
  const [fill, setFill] = useFill(stableKeyOf([params, kind, pageSize]), pageSize);
  const pages = useMemo(() => list.data?.pages ?? [], [list.data]);
  const rows = useMemo(() => flattenPages(pages), [pages]);
  const { hasNextPage, isFetchingNextPage, isFetching, isError, fetchNextPage } = list;
  const loadedPages = pages.length;
  const wantMore = shouldFetchMore({ rows: rows.length, target: fill.target, hasNextPage, busy: isFetchingNextPage || isFetching || isError, fetchedThisFill: loadedPages - 1 - fill.startPages });
  useEffect(() => {
    if (wantMore) void fetchNextPage();
  }, [wantMore, loadedPages, fetchNextPage]);
  const loadMore = useCallback(() => setFill((state) => ({ ...state, target: Math.max(state.target, rows.length) + pageSize, startPages: Math.max(0, loadedPages - 1) })), [setFill, rows.length, loadedPages, pageSize]);
  const complete = list.data !== undefined && !hasNextPage;
  const pager = appendPager({ shown: rows.length, pageSize, setPageSize, complete, isFetchingPage: isFetchingNextPage, loadMore, hasMore: hasNextPage && !wantMore });
  const status: PagedQueryStatus = {
    isLoading: list.isLoading || (rows.length === 0 && (wantMore || isFetchingNextPage)),
    isError,
    error: list.error,
    onRetry: () => void list.refetch(),
    isRefreshing: list.isPlaceholderData,
  };
  return { rows, pager, status };
}
