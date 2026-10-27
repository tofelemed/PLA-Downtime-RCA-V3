import { useState } from 'react';
import type { LossStatementRowView } from '@/api/v2/types/loss-statement';
import { Button } from '@/components/ui/button';
import { formatOperationalDate, useCalendarPreference } from '@/lib/dates';
import { groupByDay, STATEMENT_COLUMNS } from '../model/statement-page';
import { StatementRow } from './statement-row';

export interface StatementTableProps {
  rows: LossStatementRowView[];
  /** period to expand and scroll to (`focus=` in the URL) */
  focus: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  onMore: () => void;
}

const rowLabel = (row: LossStatementRowView) => [row.unitName ?? 'Unit', row.grain === 'day' ? 'Day' : (row.shiftName ?? 'Shift')].join(' · ');

/**
 * The statement per period of the window: one row per day (per shift on shift grain, grouped under the
 * day) with the ten figures as columns; a row expands to the full statement. Keyset pages: "Show more".
 */
export function StatementTable({ rows, focus, hasMore, loadingMore, onMore }: StatementTableProps) {
  const pref = useCalendarPreference();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(focus ? [focus] : []));
  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="statement-table">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th scope="col" className="px-2 py-1 text-left font-medium">Period</th>
              <th scope="col" className="px-2 py-1 text-left font-medium">Revision</th>
              {STATEMENT_COLUMNS.map((column) => (
                <th key={column.key} scope="col" className="px-2 py-1 text-right font-medium">
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          {groupByDay(rows).map((day) => (
            <tbody key={day.localDate} data-testid="statement-day" data-local-date={day.localDate}>
              <tr className="border-b bg-muted/40">
                <th scope="rowgroup" colSpan={STATEMENT_COLUMNS.length + 2} className="px-2 py-1 text-left text-xs font-semibold">
                  {formatOperationalDate(day.localDate, pref)}
                </th>
              </tr>
              {day.rows.map((row) => (
                <StatementRow key={row.periodId} row={row} label={rowLabel(row)} expanded={expanded.has(row.periodId)} focused={row.periodId === focus} onToggle={() => toggle(row.periodId)} />
              ))}
            </tbody>
          ))}
        </table>
      </div>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">No production period starts in this window.</p>}
      {hasMore && (
        <Button type="button" variant="outline" size="sm" disabled={loadingMore} onClick={onMore} data-testid="statement-more">
          Show more
        </Button>
      )}
    </div>
  );
}
