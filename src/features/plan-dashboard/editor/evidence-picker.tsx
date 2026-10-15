import { Checkbox } from '@/components/ui/checkbox';
import type { QueryParams } from '@/api/v2/request-url';
import { usePagedQuery } from '@/api/v2/queries/use-paged-query';
import type { ProductionEventView } from '@/api/v2/types/events';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { humanize } from '@/features/ux-kit/labels';
import { PlantTime } from '@/features/ux-kit/plant-time';

export interface EvidencePickerProps {
  view: ReconciliationView;
  timezone: string;
  selected: string[];
  onChange: (eventIds: string[]) => void;
}

/** Events of the period's unit overlapping the period (server filter, 20 per page); the server checks the overlap on save. */
export function EvidencePicker({ view, timezone, selected, onChange }: EvidencePickerProps) {
  const events = usePagedQuery<ProductionEventView>({
    resource: 'production-events',
    path: '/production-events',
    query: { unitIds: [view.unitId], from: view.utcStart, to: view.utcEnd } as unknown as QueryParams,
    key: { scope: { unitIds: [view.unitId] }, window: { from: view.utcStart, to: view.utcEnd }, filters: { kind: 'evidence' } },
  });
  const toggle = (id: string, on: boolean) => onChange(on ? [...selected, id] : selected.filter((e) => e !== id));
  const columns: DataTableColumn<ProductionEventView>[] = [
    {
      id: 'pick',
      header: '',
      headerLabel: 'Link as evidence',
      width: '3rem',
      cell: (e) => <Checkbox aria-label="Link this event as evidence" data-testid="evidence-event" data-event-id={e.id} checked={selected.includes(e.id)} onCheckedChange={(v) => toggle(e.id, v === true)} />,
    },
    { id: 'when', header: 'When', nowrap: true, cell: (e) => <span className="text-xs"><PlantTime iso={e.startTime} tz={timezone} /> → {e.endTime ? <PlantTime iso={e.endTime} tz={timezone} /> : 'open'}</span> },
    { id: 'what', header: 'Event', cell: (e) => humanize(e.classification?.physicalType ?? e.eventType ?? 'event') },
    { id: 'description', header: 'Description', cell: (e) => e.description ?? '—' },
  ];
  return (
    <fieldset className="min-w-0 space-y-1" data-testid="evidence-picker">
      <legend className="text-xs font-medium">Evidence events overlapping the period</legend>
      <DataTable
        caption="Events overlapping the period"
        columns={columns}
        rows={events.rows}
        getRowKey={(e) => e.id}
        pager={events.pager}
        status={events.status}
        density="compact"
        empty={{ text: 'No events overlap this period; mark the cause as “no event” instead.' }}
      />
    </fieldset>
  );
}
