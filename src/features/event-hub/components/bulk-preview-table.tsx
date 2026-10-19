import type { BulkCodePreviewView, CodingSnapshotView } from '@/api/v2/types/event-operations';
import type { BulkTarget } from '@/api/v2/types/events';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { DisabledReason } from '@/features/ux-kit/disabled-reason';
import {
  BULK_EXCLUSION_LABELS,
  CODING_STATE_LABELS,
  labelOf,
  OEE_COMPONENT_LABELS,
  SCHEDULE_CLASS_LABELS,
  useAssetNames,
} from '@/features/ux-kit/labels';
import { usePlantFormat } from '../hooks/use-plant-format';
import { bulkChanges } from '../model/bulk-preview';
import { useEventHubEnv } from '../use-event-hub-env';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

type PreviewItem = BulkCodePreviewView['items'][number];

function useCodingText() {
  const env = useEventHubEnv();
  return (value: CodingSnapshotView) =>
    `${env.reasonName(value.reasonCodeId)} · ${labelOf(SCHEDULE_CLASS_LABELS, value.scheduleClass)} / ${labelOf(OEE_COMPONENT_LABELS, value.oeeComponent)} · ${labelOf(CODING_STATE_LABELS, value.codingState)}`;
}

export interface BulkPreviewTableProps {
  preview: BulkCodePreviewView;
  /** the selected events, to name excluded ones by unit and start */
  events: readonly BulkTarget[];
  /** A-1 / SME D12: before / after columns of the asset and of "investigation pending" (when they change) */
  show?: { asset: boolean; investigation: boolean };
}

const pendingText = (value: CodingSnapshotView) => (value.investigationPending ? 'Investigation pending' : 'No');

/** The optional before → after columns of the asset and the investigation flag. */
function useExtraColumns(show: BulkPreviewTableProps['show']): DataTableColumn<PreviewItem>[] {
  const assets = useAssetNames();
  const assetText = (value: CodingSnapshotView) => (value.assetId ? assets.nameOf(value.assetId) : '—');
  const columns: DataTableColumn<PreviewItem>[] = [];
  if (show?.asset) columns.push({ id: 'asset', header: 'Asset', cell: (item) => `${assetText(item.before)} → ${assetText(item.after)}` });
  if (show?.investigation) {
    columns.push({ id: 'investigation', header: 'Investigation pending', cell: (item) => `${pendingText(item.before)} → ${pendingText(item.after)}` });
  }
  return columns;
}

/** DT10 preview: before / after per event (paged), exclusions with reasons, and the windows that will recalculate. */
export function BulkPreviewTable({ preview, events, show }: BulkPreviewTableProps) {
  const { number } = useNumberFormat();
  const env = useEventHubEnv();
  const { dateTime } = usePlantFormat();
  const codingText = useCodingText();
  const extra = useExtraColumns(show);
  const changes = bulkChanges(preview);
  const unchanged = preview.count - changes;
  const byId = new Map(events.map((event) => [event.id, event]));
  const eventText = (id: string) => {
    const event = byId.get(id);
    return event ? `${env.unitName(event.unitId)}, ${dateTime(event.startTime)}` : 'An event no longer listed';
  };
  const columns: DataTableColumn<PreviewItem>[] = [
    { id: 'event', header: 'Event', nowrap: true, cell: (item) => eventText(item.eventId) },
    { id: 'before', header: 'Before', cell: (item) => codingText(item.before) },
    { id: 'after', header: 'After', cell: (item) => (item.changed === false ? `${codingText(item.after)} · no change` : codingText(item.after)) },
    ...extra,
  ];
  return (
    <div className="space-y-3" data-testid="bulk-preview">
      <p className="text-sm">
        <strong data-testid="bulk-preview-count">{number(changes)}</strong> {changes === 1 ? 'event changes' : 'events change'} ·{' '}
        {unchanged > 0 && <><strong data-testid="bulk-preview-unchanged">{number(unchanged)}</strong> already coded this way ·{' '}</>}
        <strong data-testid="bulk-preview-exclusions">{number(preview.exclusions.length)}</strong> excluded
      </p>
      {changes === 0 && <DisabledReason id="bulk-nothing" reason="Nothing to apply: every selected event already has these codes. Choose other codes to change them." />}
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
      <div className="text-xs">
        <span className="font-medium" id="bulk-recalculates">Recalculates:</span>
        <ul aria-labelledby="bulk-recalculates" className="ml-4 list-disc">
          {preview.affectedWindows.map((window) => (
            <li key={`${window.unitId}:${window.from}`}>
              {env.unitName(window.unitId)}: {dateTime(window.from)} – {window.to ? dateTime(window.to) : 'ongoing'}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
