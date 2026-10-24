import type { ReactNode } from 'react';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export interface CaseRecordColumn {
  id: string;
  header: ReactNode;
  /** CSS width, e.g. "10rem" (several tables of a page line up) */
  width?: string;
  align?: 'left' | 'right';
  /** accessible name when `header` is not text */
  headerLabel?: string;
}

export interface CaseRecordTableProps {
  /** accessible name (visually hidden caption) */
  caption: string;
  columns: readonly CaseRecordColumn[];
  testId?: string;
  busy?: boolean;
  /** the rows: `TableRow`s with `CASE_CELL` cells (rows keep their own test ids and expansions) */
  children: ReactNode;
}

/** Cell class of a `CaseRecordTable` row: compact, top-aligned, wrapping. */
export const CASE_CELL = 'px-3 py-2 align-top text-sm';

/**
 * A record table of a case page (links, history) in the shared report look: compact rows, small uppercase
 * muted headers. Rows are rendered by the caller so they keep test ids and expandable detail rows.
 */
export function CaseRecordTable({ caption, columns, testId, busy, children }: CaseRecordTableProps) {
  return (
    <Table data-testid={testId} aria-busy={busy || undefined}>
      <caption className="sr-only">{caption}</caption>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {columns.map((column) => (
            <TableHead
              key={column.id}
              scope="col"
              aria-label={column.headerLabel}
              className={cn('h-9 px-3 text-xs uppercase tracking-wider', column.align === 'right' && 'text-right')}
              style={{ width: column.width }}
            >
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>{children}</TableBody>
    </Table>
  );
}
