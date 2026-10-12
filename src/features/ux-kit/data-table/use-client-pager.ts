import { useMemo, useState } from 'react';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagerModel, rangeOf } from './pager-model';
import { stableKeyOf } from './stable-key';
import { useResettableIndex } from './use-resettable-index';

export interface ClientPagerOptions {
  /** first page size; default 20 */
  pageSize?: number;
  /** any value (filters, search text); the pager returns to page 1 when it changes */
  resetKey?: unknown;
}

interface ClientPagerInput {
  total: number;
  pageIndex: number;
  pageSize: number;
  setIndex: (update: (index: number) => number) => void;
  setPageSize: (size: number) => void;
}

function buildClientPager({ total, pageIndex, pageSize, setIndex, setPageSize }: ClientPagerInput): PagerModel {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const last = pageCount - 1;
  const onPage = Math.min(pageSize, Math.max(0, total - pageIndex * pageSize));
  return {
    pageIndex,
    pageSize,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    setPageSize,
    canPrevious: pageIndex > 0,
    canNext: pageIndex < last,
    previous: () => setIndex((index) => Math.max(0, index - 1)),
    next: () => setIndex((index) => Math.min(last, index + 1)),
    first: () => setIndex(() => 0),
    goTo: (target) => setIndex(() => Math.min(last, Math.max(0, target))),
    pageCount,
    totalCount: total,
    ...rangeOf(pageIndex * pageSize, onPage),
    isFetchingPage: false,
    mode: 'pages',
  };
}

/**
 * Client-side paging of an array that is already in memory (aggregates, previews, v1 arrays): returns
 * the rows of the current page and a `PagerModel` for `ListPager` / `DataTable`. Returns to page 1 when
 * `resetKey` or the page size changes, or when the rows shrink below the current page.
 *
 * @example const { rows, pager } = useClientPager(items, { resetKey: search });
 */
export function useClientPager<T>(rows: readonly T[], options: ClientPagerOptions = {}): { rows: T[]; pager: PagerModel } {
  const [pageSize, setPageSizeState] = useState(options.pageSize ?? DEFAULT_PAGE_SIZE);
  const [storedIndex, setIndex] = useResettableIndex(`${stableKeyOf(options.resetKey)}|${pageSize}`);
  const pageIndex = storedIndex * pageSize >= rows.length ? 0 : storedIndex;
  if (pageIndex !== storedIndex) setIndex(() => 0);
  const total = rows.length;
  const pager = useMemo(
    () => buildClientPager({ total, pageIndex, pageSize, setIndex, setPageSize: setPageSizeState }),
    [total, pageIndex, pageSize, setIndex],
  );
  const pageRows = useMemo(() => rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize), [rows, pageIndex, pageSize]);
  return { rows: pageRows, pager };
}
