import type { RcaHistoryEntryView } from '@/api/v2/types/rca-history';
import { fieldChangeText } from '../../model/history-item-changes';
import { historyActionLabel, historyActor, historyFieldLabel, historyValueLines, visibleChangedFields, type HistoryResolvers } from '../../model/history-entry';

export interface HistoryEntryItemProps {
  entry: RcaHistoryEntryView;
  resolve: HistoryResolvers;
  /** the entry's time in plant time */
  when: string;
}

/** One history entry: when, who, what in words, the changed fields, before → after values and the reason. */
export function HistoryEntryItem({ entry, resolve, when }: HistoryEntryItemProps) {
  const lines = historyValueLines(entry, resolve);
  const shown = new Set(lines.map((line) => line.field.replace(/Length$/, '')));
  const others = visibleChangedFields(entry.changedFields).filter((field) => !shown.has(field));
  return (
    <li className="space-y-1 p-3 text-sm" data-testid="history-entry" data-action={entry.action}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium" data-testid="history-action">{historyActionLabel(entry.action)}</span>
        <span className="text-muted-foreground">
          <time dateTime={entry.at}>{when}</time> · <span data-testid="history-actor">{historyActor(entry)}</span>
        </span>
      </div>
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
        <p className="whitespace-pre-wrap" data-testid="history-reason">
          Reason: {entry.reason}
        </p>
      )}
    </li>
  );
}
