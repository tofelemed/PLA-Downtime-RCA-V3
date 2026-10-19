import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { cn } from '@/lib/utils';
import { AnchorPageSync } from './anchor-page-sync';
import { DataTableGrid } from './data-table-grid';
import { ListPager } from './data-table-pager';
import { RefreshBar } from './data-table-states';
import type { DataTableProps } from './data-table-types';
import type { PagerModel } from './pager-model';
import { useClientPager } from './use-client-pager';
import { VirtualDataTable } from './virtual-data-table';

function usePagedRows<T>(rows: readonly T[], pager: DataTableProps<T>['pager']): { rows: readonly T[]; pager: PagerModel | null; client: boolean } {
  const client = useClientPager(rows);
  if (pager === undefined || pager === 'client') return { ...client, client: true };
  return { rows, pager: pager === 'none' ? null : pager, client: false };
}

function DataTableBody<T>(props: DataTableProps<T> & { visibleRows: readonly T[] }) {
  const { virtualize, pager, status, visibleRows } = props;
  const density = props.density ?? 'comfortable';
  if (virtualize && pager === 'none' && !status?.isLoading) {
    return <VirtualDataTable {...props} rows={visibleRows} density={density} rowHeight={virtualize.rowHeight} height={virtualize.height} />;
  }
  return (
    <DataTableGrid
      {...props}
      rows={visibleRows}
      density={density}
      stickyHeader={props.stickyHeader ?? true}
      isLoading={Boolean(status?.isLoading)}
    />
  );
}

/**
 * The standard table of the app (docs/UI_UX_AUDIT.md §3): at most 20 rows on the first page, a pager
 * under the table, loading skeleton / empty / error states, a thin refresh bar that keeps the previous
 * rows visible, sticky header and keyboard-activatable rows. Cells must show labels, never internal ids
 * (plain-text cells are checked in development).
 *
 * - In-memory rows: pass them all; the table pages them (`pager` defaults to `'client'`).
 * - Server keyset lists: `const { rows, pager, status } = usePagedQuery<T>(…)` and pass all three.
 * - Short fixed lists: `pager="none"`; long in-memory lists without paging: `pager="none"` + `virtualize`.
 * - Deep links: with `getRowAnchor`, a client-paged table opens the page holding the row named by the URL hash.
 *
 * @example
 * <DataTable caption="Production events" columns={columns} rows={rows} getRowKey={(e) => e.id}
 *   pager={pager} status={status} onRowClick={open} rowLabel={(e) => e.reasonLabel} />
 */
export function DataTable<T>(props: DataTableProps<T>) {
  const { status, caption, className } = props;
  const paged = usePagedRows(props.rows, props.pager);
  if (status?.isError) {
    const state = dataStateOf({ isLoading: false, isError: true, error: status.error });
    return <DataState state={state} error={status.error} onRetry={status.onRetry} />;
  }
  return (
    <div className={cn('space-y-3', className)}>
      <AnchorPageSync rows={props.rows} getRowAnchor={props.getRowAnchor} pager={paged.client ? paged.pager : null} />
      <div className="relative rounded-md border">
        {status?.isRefreshing && !status.isLoading && <RefreshBar />}
        <DataTableBody {...props} visibleRows={paged.rows} />
      </div>
      {paged.pager && !status?.isLoading && <ListPager pager={paged.pager} label={`${caption} pages`} />}
    </div>
  );
}
