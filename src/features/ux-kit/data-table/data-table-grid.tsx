import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useReportLook } from '../report-look/use-report-look';
import { cellClass, headClass, renderCellValue, rowActivationProps, rowHintOf, rowLabelHint } from './data-table-cells';
import { EmptyRow, SkeletonRows } from './data-table-states';
import type { DataTableColumn, DataTableDensity, DataTableEmpty } from './data-table-types';

export interface DataTableGridProps<T> {
  caption: string;
  columns: ReadonlyArray<DataTableColumn<T>>;
  rows: readonly T[];
  getRowKey: (row: T) => string;
  getRowAnchor?: (row: T) => string | undefined;
  density: DataTableDensity;
  stickyHeader: boolean;
  maxHeight?: number | string;
  isLoading: boolean;
  empty?: DataTableEmpty;
  onRowClick?: (row: T) => void;
  rowLabel?: (row: T) => string;
  rowsHaveLink?: boolean;
  scrollable?: boolean;
}

/** Header cells of a report table (Reports page): small, uppercase and muted. */
const REPORT_HEAD = 'text-xs uppercase tracking-wider';

function GridHeader<T>({ columns, density, sticky }: { columns: ReadonlyArray<DataTableColumn<T>>; density: DataTableDensity; sticky: boolean }) {
  const report = useReportLook() !== null;
  return (
    <TableHeader className={cn(sticky && 'sticky top-0 z-10 bg-background shadow-[inset_0_-1px_0_hsl(var(--border))]')}>
      <TableRow className="hover:bg-transparent">
        {columns.map((column) => (
          <TableHead key={column.id} scope="col" aria-label={column.headerLabel} className={cn(headClass(column, density), report && REPORT_HEAD)} style={{ width: column.width }}>
            {column.header}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}

function GridRows<T>(props: DataTableGridProps<T>) {
  const { columns, rows, getRowKey, getRowAnchor, density, onRowClick, rowsHaveLink, caption } = props;
  return (
    <>
      {rows.map((row, index) => {
        const activation = rowActivationProps(onRowClick && (() => onRowClick(row)), rowsHaveLink);
        const hint = rowHintOf(row, props);
        return (
          <TableRow key={getRowKey(row)} {...activation} id={getRowAnchor?.(row)} className={cn(getRowAnchor && 'scroll-mt-24', activation.className)}>
            {columns.map((column, columnIndex) => (
              <TableCell key={column.id} className={cellClass(column, density)}>
                {columnIndex === 0 && rowLabelHint(hint)}
                {renderCellValue(column, row, index, caption)}
              </TableCell>
            ))}
          </TableRow>
        );
      })}
    </>
  );
}

/**
 * The `<table>` of a non-virtualized `DataTable`: visually hidden caption, `th scope="col"`, sticky
 * header inside its own scroll box (ui/table's wrapper would capture `position: sticky`, so the
 * wrapper is rendered here with `maxHeight`).
 */
export function DataTableGrid<T>(props: DataTableGridProps<T>) {
  const { caption, columns, rows, density, stickyHeader, maxHeight, isLoading, empty, scrollable } = props;
  const region = scrollable ? { role: 'region', tabIndex: 0, 'aria-label': `${caption} (scrolls sideways)` } : {};
  const body = isLoading ? (
    <SkeletonRows columnCount={columns.length} />
  ) : rows.length === 0 ? (
    <EmptyRow columnCount={columns.length} empty={empty} />
  ) : (
    <GridRows {...props} />
  );
  return (
    <div className="relative w-full overflow-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" style={{ maxHeight }} data-sticky-header={stickyHeader || undefined} {...region}>
      <table className="w-full caption-bottom text-sm" aria-busy={isLoading || undefined}>
        <caption className="sr-only">{caption}</caption>
        <GridHeader columns={columns} density={density} sticky={stickyHeader} />
        <TableBody>{body}</TableBody>
      </table>
    </div>
  );
}
