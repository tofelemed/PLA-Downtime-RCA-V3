import type { HandoverEventView } from '@/api/v2/types/ops-reports';
import { Badge } from '@/components/ui/badge';
import { formatTime, useCalendarPreference } from '@/lib/dates';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { DurationText } from '@/features/ux-kit/duration-text';
import { CODING_STATE_LABELS, EVENT_TYPE_LABELS } from '../model/labels';

const causeOf = (event: HandoverEventView) => {
  if (event.physicalType === 'grade_transition') return `${event.fromProduct ?? '?'} → ${event.toProduct ?? '?'}`;
  return event.reason ?? 'No reason yet';
};

function Coding({ event }: { event: HandoverEventView }) {
  return (
    <span className="flex flex-wrap gap-1">
      <Badge variant={event.codingState === 'uncoded' ? 'destructive' : 'secondary'}>{CODING_STATE_LABELS[event.codingState] ?? event.codingState}</Badge>
      {event.verified && <Badge variant="outline">Verified</Badge>}
    </span>
  );
}

/** The loss events of a shift (R2), oldest first: time on the plant clock, cause, duration, coding. */
export function HandoverEventsTable({ events, timeZone }: { events: readonly HandoverEventView[]; timeZone: string }) {
  const pref = useCalendarPreference();
  const time = (iso: string) => formatTime(iso, { timeZone, ...pref });
  const columns: Array<DataTableColumn<HandoverEventView>> = [
    { id: 'time', header: 'Time', nowrap: true, cell: (e) => <span data-testid="handover-event" data-type={e.physicalType}>{`${time(e.start)} – ${e.end ? time(e.end) : 'running'}`}</span> },
    { id: 'unit', header: 'Unit', cell: (e) => e.unitName ?? '—' },
    { id: 'type', header: 'Event', cell: (e) => EVENT_TYPE_LABELS[e.physicalType] ?? e.physicalType },
    { id: 'cause', header: 'Reason / grades', cell: (e) => causeOf(e) },
    { id: 'asset', header: 'Asset', cell: (e) => e.asset ?? '—' },
    { id: 'duration', header: 'Duration', align: 'right', nowrap: true, cell: (e) => (e.seconds === null ? 'running' : <DurationText seconds={e.seconds} />) },
    { id: 'coding', header: 'Coding', cell: (e) => <Coding event={e} /> },
  ];
  return <DataTable caption="Events of the shift" columns={columns} rows={[...events]} getRowKey={(e) => e.id} density="compact" />;
}
