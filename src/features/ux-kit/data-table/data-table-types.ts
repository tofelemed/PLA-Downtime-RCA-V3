import type { ReactNode } from 'react';
import type { PagerModel } from './pager-model';

/** One column of a `DataTable`. `cell` returns display text (never a raw id) or an element. */
export interface DataTableColumn<T> {
  id: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  align?: 'left' | 'right' | 'center';
  /** CSS width, e.g. "8rem" or "20%" (virtualized tables use it as the grid track) */
  width?: string;
  nowrap?: boolean;
  /** accessible column name when `header` is not text (an icon, a checkbox) */
  headerLabel?: string;
}

/** Query facts of the rows; `usePagedQuery` returns this object as `status`. */
export interface DataTableStatus {
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** new data is on its way while the previous rows stay visible (thin bar on top) */
  isRefreshing?: boolean;
}

export interface DataTableEmpty {
  title?: string;
  text?: string;
  /** e.g. a "Clear filters" or "Add unit" button */
  action?: ReactNode;
}

export type DataTableDensity = 'comfortable' | 'compact';

export interface DataTableProps<T> {
  /** accessible name of the table (rendered as a visually hidden caption) */
  caption: string;
  columns: ReadonlyArray<DataTableColumn<T>>;
  rows: readonly T[];
  getRowKey: (row: T) => string;
  /**
   * `'client'` (default): the table pages `rows` itself, 20 per page. A `PagerModel` (from
   * `usePagedQuery` / `useClientPager`): `rows` is already the current page. `'none'`: all rows, only
   * for short fixed lists or with `virtualize`.
   */
  pager?: PagerModel | 'client' | 'none';
  status?: DataTableStatus;
  empty?: DataTableEmpty;
  /** makes rows keyboard-activatable (Enter / Space) and clickable */
  onRowClick?: (row: T) => void;
  /** accessible name of an activatable row, e.g. the event's reason and start */
  rowLabel?: (row: T) => string;
  /** default true: the header stays visible while the body scrolls inside `maxHeight` */
  stickyHeader?: boolean;
  maxHeight?: number | string;
  /** long in-memory lists with `pager: 'none'` only: render only the visible window of rows */
  virtualize?: { rowHeight: number; height: number };
  density?: DataTableDensity;
  className?: string;
}
