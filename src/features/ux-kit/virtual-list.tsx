import { useEffect, useRef, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

export interface VirtualListProps<TItem> {
  items: readonly TItem[];
  /** estimated row height in px (rows may be taller; they are measured) */
  rowHeight: number;
  /** viewport height in px */
  height: number;
  renderRow: (item: TItem, index: number) => ReactNode;
  getKey: (item: TItem, index: number) => string;
  /** called when the last rows come into view: fetch (prefetch) the next server page */
  onEndReached?: () => void;
  /** rows before the end that trigger `onEndReached` */
  endThreshold?: number;
  className?: string;
}

/**
 * Virtualized list for long tables (plan 3.1, ENGINEERING_STANDARDS): only visible rows are in the DOM;
 * reaching the end asks for the next keyset page, so lists never load a whole tenant.
 */
export function VirtualList<TItem>(props: VirtualListProps<TItem>) {
  const { items, rowHeight, height, renderRow, getKey, onEndReached, endThreshold = 10 } = props;
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
    getItemKey: (index) => getKey(items[index], index),
  });
  const rows = virtualizer.getVirtualItems();
  const lastIndex = rows.length > 0 ? rows[rows.length - 1].index : -1;

  useEffect(() => {
    if (onEndReached && lastIndex >= 0 && lastIndex >= items.length - endThreshold) onEndReached();
  }, [lastIndex, items.length, endThreshold, onEndReached]);

  return (
    <div ref={parentRef} className={props.className} style={{ height, overflowY: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {rows.map((row) => (
          <div
            key={row.key}
            data-index={row.index}
            ref={virtualizer.measureElement}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${row.start}px)` }}
          >
            {renderRow(items[row.index], row.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
