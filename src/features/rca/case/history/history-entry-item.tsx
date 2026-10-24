import type { RcaHistoryEntryView } from '@/api/v2/types/rca-history';
import { TableCell, TableRow } from '@/components/ui/table';
import { fieldChangeText } from '../../model/history-item-changes';
import { historyActionLabel, historyActor, historyFieldLabel, historyValueLines, visibleChangedFields, type HistoryResolvers } from '../../model/history-entry';
import { CASE_CELL } from '../components/case-record-table';

export interface HistoryEntryItemProps {
  entry: RcaHistoryEntryView;
  resolve: HistoryResolvers;
  /** the entry's time in plant time */
  when: string;
}

/** One history row: when, who, and what in words — the changed fields, before → after values and the reason. */
export function HistoryEntryItem({ entry, resolve, when }: HistoryEntryItemProps) {
  const lines = historyValueLines(entry, resolve);
  const shown = new Set(lines.map((line) => line.field.replace(/Length$/, '')));
  const others = visibleChangedFields(entry.changedFields).filter((field) => !shown.has(field));
  return (
    <TableRow data-testid="history-entry" data-action={entry.action}>
      <TableCell className={`${CASE_CELL} whitespace-nowrap text-muted-foreground`}>
        <time dateTime={entry.at}>{when}</time>
      </TableCell>
      <TableCell className={CASE_CELL} data-testid="history-actor">
        {historyActor(entry)}
      </TableCell>
      <TableCell className={`${CASE_CELL} space-y-0.5`}>
        <p className="font-medium" data-testid="history-action">
          {historyActionLabel(entry.action)}
        </p>
        {lines.length > 0 && (
          <ul className="space-y-0.5" aria-label="Values changed">
            {lines.map((line) => (
              <li key={line.field} data-testid="history-value">
                {line.label}: {line.from} → {line.to}
              </li>
            ))}
          </ul>
        )}
        {others.length > 0 && (
          <p className="text-muted-foreground" data-testid="history-fields">
            Changed: {others.map((field) => fieldChangeText(entry, field, historyFieldLabel(field))).join(' · ')}
          </p>
        )}
        {entry.reason && (
          <p className="max-w-[75ch] whitespace-pre-wrap" data-testid="history-reason">
            Reason: {entry.reason}
          </p>
        )}
      </TableCell>
    </TableRow>
  );
}
