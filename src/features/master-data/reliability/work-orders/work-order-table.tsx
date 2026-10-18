import { Link } from 'react-router-dom';
import { useWorkOrderOperationsPage, type WorkOrderFilters } from '@/api/v2/queries/reliability-work-orders';
import type { OperationKind, WorkOrderOperationView } from '@/api/v2/types/reliability';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { useAssetLookup } from '../shared/use-asset-lookup';
import type { ReliabilityFormat } from '../shared/use-reliability-format';

const OPERATION_KIND_LABELS: Readonly<Record<OperationKind, string>> = {
  diagnosis: 'Diagnosis (active repair)',
  repair: 'Repair (active repair)',
  test: 'Functional test (active repair)',
  other: 'Other (not active repair)',
};

function columnsOf(format: ReliabilityFormat, assetLabel: (id: string | null) => string): DataTableColumn<WorkOrderOperationView>[] {
  return [
    { id: 'wo', header: 'Work order / operation', cell: (o) => `${o.workOrderId} / ${o.operationId}`, nowrap: true },
    { id: 'kind', header: 'Kind', cell: (o) => OPERATION_KIND_LABELS[o.kind] },
    { id: 'asset', header: 'Asset', cell: (o) => assetLabel(o.assetId) },
    { id: 'start', header: 'Actual start', cell: (o) => format.dateTime(o.startedAt), nowrap: true },
    { id: 'end', header: 'Actual end', cell: (o) => (o.endedAt ? format.dateTime(o.endedAt) : 'Still running'), nowrap: true },
    { id: 'waiting', header: 'Waiting', cell: (o) => (o.waitingSeconds > 0 ? `${format.duration(o.waitingSeconds)}${o.waitingReason ? ` — ${o.waitingReason}` : ''}` : '—') },
    { id: 'stop', header: 'Stop', cell: (o) => (o.eventId ? <Link className="underline" to={`/events/${o.eventId}?tab=repair`}>Open the stop</Link> : 'Not linked') },
    { id: 'source', header: 'Source', cell: (o) => o.source },
  ];
}

/** CMMS operations per stop or asset, as the server filters them (keyset pages of 20). */
export function WorkOrderTable({ filters, format }: { filters: WorkOrderFilters; format: ReliabilityFormat }) {
  const page = useWorkOrderOperationsPage(filters);
  const { labelOf } = useAssetLookup();
  return (
    <DataTable
      caption="Work-order operations"
      columns={columnsOf(format, labelOf)}
      rows={page.rows}
      pager={page.pager}
      getRowKey={(o) => o.id}
      status={page.status}
      empty={{ title: 'No operations', text: 'Import the CMMS export to record active repair time.' }}
    />
  );
}
