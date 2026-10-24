import type { ReactNode } from 'react';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { cn } from '@/lib/utils';

export interface FmeaColumn {
  label: string;
  /** numbers (ratings, RPN) are right-aligned */
  numeric?: boolean;
}

const HEAD = 'px-2 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap';

/** A compact FMEA table (report look: small uppercase headers) with its h3 title and ⓘ, the rows from the caller. */
export function FmeaTable({ title, info, columns, editable, empty, children }: { title: string; info: ReactNode; columns: readonly FmeaColumn[]; editable: boolean; empty: boolean; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <h3 className="text-sm font-semibold text-heading">{title}</h3>
        <KpiInfo label={title} text={info} />
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full border-collapse" aria-label={title}>
          <thead className="border-b bg-muted/40">
            <tr>
              {columns.map((column) => (
                <th key={column.label} scope="col" className={cn(HEAD, column.numeric ? 'text-right' : 'text-left')}>
                  {column.label}
                </th>
              ))}
              {editable && (
                <th scope="col" className={HEAD}>
                  <span className="sr-only">Remove</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {empty ? (
              <tr>
                <td colSpan={columns.length + (editable ? 1 : 0)} className="px-2 py-4 text-center text-sm text-muted-foreground">
                  None yet.
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
