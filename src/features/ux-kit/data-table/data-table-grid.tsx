import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { cellClass, headClass, renderCellValue, rowActivationProps, rowHintOf, rowLabelHint } from './data-table-cells';
import { EmptyRow, SkeletonRows } from './data-table-states';
import type { DataTableColumn, DataTableDensity, DataTableEmpty } from './data-table-types';

export interface DataTableGridProps<T> {
  caption: string;
  columns: ReadonlyArray<DataTableColumn<T>>;
  rows: readonly T[];
  getRowKey: (row: T) => string;
  density: DataTableDensity;
  stickyHeader: boolean;
  maxHeight?: number | string;
  isLoading: boolean;
  empty?: DataTableEmpty;
  onRowClick?: (row: T) => void;
  rowLabel?: (row: T) => string;
  rowsHaveLink?: boolean;
}

function GridHeader<T>({ columns, density, sticky }: { columns: ReadonlyArray<DataTableColumn<T>>; density: DataTableDensity; sticky: boolean }) {
  return (
    <TableHeader className={cn(sticky && 'sticky top-0 z-10 bg-background shadow-[inset_0_-1px_0_hsl(var(--border))]')}>
      <TableRow className="hover:bg-transparent">
        {columns.map((column) => (
          <TableHead key={column.id} scope="col" aria-label={column.headerLabel} className={headClass(column, density)} style={{ width: column.width }}>
            {column.header}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}

function GridRows<T>(props: DataTableGridProps<T>) {
  const { columns, rows, getRowKey, density, onRowClick, rowsHaveLink, caption } = props;
  return (
    <>
      {rows.map((row, index) => {
        const activation = rowActivationProps(onRowClick && (() => onRowClick(row)), rowsHaveLink);
        const hint = rowHintOf(row, props);
        return (
          <TableRow key={getRowKey(row)} {...activation}>
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
  const { caption, columns, rows, density, stickyHeader, maxHeight, isLoading, empty } = props;
  const body = isLoading ? (
    <SkeletonRows columnCount={columns.length} />
  ) : rows.length === 0 ? (
    <EmptyRow columnCount={columns.length} empty={empty} />
  ) : (
    <GridRows {...props} />
  );
  return (
    <div className="relative w-full overflow-auto" style={{ maxHeight }} data-sticky-header={stickyHeader || undefined}>
      <table className="w-full caption-bottom text-sm" aria-busy={isLoading || undefined}>
        <caption className="sr-only">{caption}</caption>
        <GridHeader columns={columns} density={density} sticky={stickyHeader} />
        <TableBody>{body}</TableBody>
      </table>
    </div>
  );
}
