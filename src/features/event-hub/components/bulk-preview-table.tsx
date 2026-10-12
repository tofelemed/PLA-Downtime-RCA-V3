import type { BulkCodePreviewView, CodingSnapshotView } from '@/api/v2/types/event-operations';
import type { ProductionEventView } from '@/api/v2/types/events';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import {
  BULK_EXCLUSION_LABELS,
  CODING_STATE_LABELS,
  labelOf,
  OEE_COMPONENT_LABELS,
  SCHEDULE_CLASS_LABELS,
} from '@/features/ux-kit/labels';
import { usePlantFormat } from '../hooks/use-plant-format';
import { useEventHubEnv } from '../use-event-hub-env';

type PreviewItem = BulkCodePreviewView['items'][number];

function useCodingText() {
  const env = useEventHubEnv();
  return (value: CodingSnapshotView) =>
    `${env.reasonName(value.reasonCodeId)} · ${labelOf(SCHEDULE_CLASS_LABELS, value.scheduleClass)} / ${labelOf(OEE_COMPONENT_LABELS, value.oeeComponent)} · ${labelOf(CODING_STATE_LABELS, value.codingState)}`;
}

export interface BulkPreviewTableProps {
  preview: BulkCodePreviewView;
  /** the selected events, to name excluded ones by unit and start */
  events: readonly ProductionEventView[];
}

/** DT10 preview: before / after per event (paged), exclusions with reasons, and the windows that will recalculate. */
export function BulkPreviewTable({ preview, events }: BulkPreviewTableProps) {
  const env = useEventHubEnv();
  const { dateTime } = usePlantFormat();
  const codingText = useCodingText();
  const byId = new Map(events.map((event) => [event.id, event]));
  const eventText = (id: string) => {
    const event = byId.get(id);
    return event ? `${env.unitName(event.unitId)}, ${dateTime(event.startTime)}` : 'An event no longer listed';
  };
  const columns: DataTableColumn<PreviewItem>[] = [
    { id: 'event', header: 'Event', nowrap: true, cell: (item) => eventText(item.eventId) },
    { id: 'before', header: 'Before', cell: (item) => codingText(item.before) },
    { id: 'after', header: 'After', cell: (item) => codingText(item.after) },
  ];
  return (
    <div className="space-y-3" data-testid="bulk-preview">
      <p className="text-sm">
        <strong data-testid="bulk-preview-count">{preview.count}</strong> events change ·{' '}
        <strong data-testid="bulk-preview-exclusions">{preview.exclusions.length}</strong> excluded
      </p>
      <DataTable caption="Coding before and after" columns={columns} rows={preview.items} getRowKey={(item) => item.eventId} density="compact" />
      {preview.exclusions.length > 0 && (
        <ul className="text-xs text-destructive" aria-label="Excluded events">
          {preview.exclusions.map((exclusion) => (
            <li key={`${exclusion.eventId}:${exclusion.reason}`}>
              {eventText(exclusion.eventId)}: {labelOf(BULK_EXCLUSION_LABELS, exclusion.reason)}
            </li>
          ))}
        </ul>
      )}
      <div className="text-xs" aria-label="Windows that will recalculate">
        <span className="font-medium">Recalculates: </span>
        {preview.affectedWindows.map((window) => (
          <span key={`${window.unitId}:${window.from}`} className="mr-2 inline-block">
            {env.unitName(window.unitId)} {dateTime(window.from)} – {window.to ? dateTime(window.to) : 'running'}
          </span>
        ))}
      </div>
    </div>
  );
}
