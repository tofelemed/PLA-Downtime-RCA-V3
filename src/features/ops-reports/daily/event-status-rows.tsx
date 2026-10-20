import type { EventStatusRowView } from '@/api/v2/types/ops-reports';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { DurationText } from '@/features/ux-kit/duration-text';
import { NumberText } from '@/features/ux-kit/number-text';
import { EVENT_TYPE_LABELS } from '../model/labels';

const COLUMNS: Array<DataTableColumn<EventStatusRowView>> = [
  { id: 'type', header: 'Events', cell: (row) => <span data-testid="event-status-row" data-type={row.physicalType}>{EVENT_TYPE_LABELS[row.physicalType] ?? row.physicalType}</span> },
  { id: 'events', header: 'Total', align: 'right', cell: (row) => <NumberText value={row.events} /> },
  { id: 'open', header: 'Still running', align: 'right', cell: (row) => <NumberText value={row.open} /> },
  { id: 'uncoded', header: 'Not coded', align: 'right', cell: (row) => <NumberText value={row.uncoded} /> },
  { id: 'verified', header: 'Verified', align: 'right', cell: (row) => <NumberText value={row.verified} /> },
  { id: 'seconds', header: 'Duration', align: 'right', nowrap: true, cell: (row) => <DurationText seconds={row.seconds} /> },
  { id: 'uncodedSeconds', header: 'Not coded duration', align: 'right', nowrap: true, cell: (row) => <DurationText seconds={row.uncodedSeconds} /> },
];

/** Coding and verification counts per event type (server rows). */
export function EventStatusRows({ rows }: { rows: readonly EventStatusRowView[] }) {
  return <DataTable caption="Events: coding and verification" columns={COLUMNS} rows={[...rows]} getRowKey={(row) => row.physicalType} density="compact" />;
}
