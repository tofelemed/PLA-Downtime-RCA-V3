import { Skeleton } from '@/components/ui/skeleton';
import { TableCell, TableRow } from '@/components/ui/table';
import type { ReactNode } from 'react';
import { StatusIcon } from '@/lib/icons';
import type { DataTableEmpty } from './data-table-types';

const SKELETON_ROWS = 5;

/** Placeholder rows while the first page loads (the table carries `aria-busy`). */
export function SkeletonRows({ columnCount }: { columnCount: number }) {
  return (
    <>
      {Array.from({ length: SKELETON_ROWS }, (_, row) => (
        <TableRow key={row} aria-hidden="true" className="hover:bg-transparent">
          {Array.from({ length: columnCount }, (_, column) => (
            <TableCell key={column} className="px-4 py-3">
              <Skeleton className="h-4 w-full max-w-[12rem]" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

/** Empty state inside the table body, so the column headers keep their context. */
export function EmptyRow({ columnCount, empty }: { columnCount: number; empty?: DataTableEmpty }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={columnCount} className="px-4 py-10">
        <EmptyMessage empty={empty} />
      </TableCell>
    </TableRow>
  );
}

/** Icon, title, explanation and optional action of an empty list. */
export function EmptyMessage({ empty }: { empty?: DataTableEmpty }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center" data-state="empty">
      <StatusIcon.empty aria-hidden="true" className="h-6 w-6 text-muted-foreground" />
      <p className="font-medium">{empty?.title ?? 'No data'}</p>
      <p className="text-sm text-muted-foreground">{empty?.text ?? 'Nothing matches the current filters.'}</p>
      {empty?.action}
    </div>
  );
}

/** A list's or card's own empty result (a real result, e.g. "Nothing overdue."), centred, without a hint; its action (e.g. "Clear filters") stays. */
export function OwnEmptyMessage({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center" data-state="empty" data-testid="own-empty">
      <StatusIcon.empty aria-hidden="true" className="h-6 w-6 text-muted-foreground" />
      <p className="font-medium">{text}</p>
      {action}
    </div>
  );
}

/** Thin indeterminate bar on top of the table while new rows load behind the visible ones. */
export function RefreshBar() {
  return (
    <div role="progressbar" aria-label="Refreshing" className="absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden bg-primary/20">
      <div className="h-full w-1/3 animate-pulse bg-primary" />
    </div>
  );
}
