import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import { cellClass, headClass, renderCellValue, rowActivationProps } from './data-table-cells';
import { EmptyMessage } from './data-table-states';
import type { DataTableColumn, DataTableDensity, DataTableEmpty } from './data-table-types';

export interface VirtualDataTableProps<T> {
  caption: string;
  columns: ReadonlyArray<DataTableColumn<T>>;
  rows: readonly T[];
  getRowKey: (row: T) => string;
  density: DataTableDensity;
  rowHeight: number;
  height: number;
  empty?: DataTableEmpty;
  onRowClick?: (row: T) => void;
  rowLabel?: (row: T) => string;
}

const gridTemplate = <T,>(columns: ReadonlyArray<DataTableColumn<T>>) =>
  columns.map((column) => column.width ?? 'minmax(0, 1fr)').join(' ');

function VirtualHeader<T>({ columns, density, template }: { columns: ReadonlyArray<DataTableColumn<T>>; density: DataTableDensity; template: string }) {
  return (
    <div role="rowgroup" className="border-b bg-background">
      <div role="row" aria-rowindex={1} className="grid items-center" style={{ gridTemplateColumns: template }}>
        {columns.map((column) => (
          <div key={column.id} role="columnheader" aria-label={column.headerLabel} className={cn('flex items-center font-medium text-muted-foreground', headClass(column, density))}>
            {column.header}
          </div>
        ))}
      </div>
    </div>
  );
}

interface VirtualRowProps<T> extends Pick<VirtualDataTableProps<T>, 'caption' | 'columns' | 'density' | 'rowHeight' | 'onRowClick' | 'rowLabel'> {
  row: T;
  index: number;
  start: number;
  template: string;
}

function VirtualRow<T>({ row, index, start, template, columns, density, rowHeight, caption, onRowClick, rowLabel }: VirtualRowProps<T>) {
  const activation = rowActivationProps(onRowClick && (() => onRowClick(row)), rowLabel?.(row));
  return (
    <div
      role="row"
      aria-rowindex={index + 2}
      {...activation}
      className={cn('absolute left-0 top-0 grid w-full items-center border-b hover:bg-muted/50', activation.className)}
      style={{ gridTemplateColumns: template, height: rowHeight, transform: `translateY(${start}px)` }}
    >
      {columns.map((column) => (
        <div key={column.id} role="cell" className={cn('truncate', cellClass(column, density))}>
          {renderCellValue(column, row, index, caption)}
        </div>
      ))}
    </div>
  );
}

/**
 * Virtualized `DataTable` body (only the visible window of rows is in the DOM). A `<table>` cannot hold
 * absolutely positioned rows, so this renders a CSS grid with ARIA table roles: `role="table"` named by
 * the caption, `rowgroup` / `row` / `columnheader` / `cell`, `aria-rowcount` for the full length and
 * `aria-rowindex` on every row, so screen readers still announce "row 120 of 2,000". The header sits
 * outside the scroll box, so it is always visible. Rows have the fixed `rowHeight` (cells truncate).
 */
export function VirtualDataTable<T>(props: VirtualDataTableProps<T>) {
  const { caption, columns, rows, getRowKey, density, rowHeight, height } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
    initialRect: { width: 0, height },
    getItemKey: (index) => getRowKey(rows[index]),
  });
  const template = gridTemplate(columns);
  return (
    <div role="table" aria-label={caption} aria-rowcount={rows.length + 1} className="w-full text-sm">
      <VirtualHeader columns={columns} density={density} template={template} />
      {rows.length === 0 ? (
        <div className="px-4 py-10">
          <EmptyMessage empty={props.empty} />
        </div>
      ) : (
        <div ref={scrollRef} role="rowgroup" style={{ height, overflowY: 'auto' }}>
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((item) => (
              <VirtualRow key={item.key} {...props} row={rows[item.index]} index={item.index} start={item.start} template={template} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
