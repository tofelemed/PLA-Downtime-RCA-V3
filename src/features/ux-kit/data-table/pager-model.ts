/** Rows on the first page of every long table (owner rule: at most 20 rows before paging). */
export const DEFAULT_PAGE_SIZE = 20;

/** Choices of the "Rows per page" selector; the choice is not persisted. */
export const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

/**
 * State and commands of one pager, shared by client-side paging (`useClientPager`) and server keyset
 * paging (`usePagedQuery`). `ListPager` renders it; `DataTable` accepts it as `pager`.
 *
 * - `pageIndex` is 0-based; `rangeStart` / `rangeEnd` are 1-based row numbers (0 / 0 when empty).
 * - `pageCount` / `totalCount` are null while unknown (keyset lists without a total).
 * - `mode: 'append'` lists grow with `loadMore()` ("Show more") instead of turning pages.
 */
export interface PagerModel {
  pageIndex: number;
  pageSize: number;
  pageSizeOptions: readonly number[];
  setPageSize(size: number): void;
  canPrevious: boolean;
  canNext: boolean;
  previous(): void;
  next(): void;
  first(): void;
  goTo?(pageIndex: number): void;
  pageCount: number | null;
  totalCount: number | null;
  rangeStart: number;
  rangeEnd: number;
  isFetchingPage: boolean;
  mode: 'pages' | 'append';
  loadMore?(): void;
  hasMore?: boolean;
}

/** 1-based range of a page that starts after `rowsBefore` rows and holds `rowsOnPage` rows. */
export function rangeOf(rowsBefore: number, rowsOnPage: number): { rangeStart: number; rangeEnd: number } {
  if (rowsOnPage <= 0) return { rangeStart: 0, rangeEnd: 0 };
  return { rangeStart: rowsBefore + 1, rangeEnd: rowsBefore + rowsOnPage };
}

/**
 * True when a pager has nothing to offer: everything fits on the first page and the list is no longer
 * than the smallest page size (so the size selector cannot change anything either).
 */
export function isPagerHidden(pager: PagerModel): boolean {
  const smallest = Math.min(...pager.pageSizeOptions, pager.pageSize);
  const shown = pager.totalCount ?? pager.rangeEnd;
  if (pager.mode === 'append') return !pager.hasMore && shown <= smallest;
  return pager.pageIndex === 0 && !pager.canNext && shown <= smallest;
}
