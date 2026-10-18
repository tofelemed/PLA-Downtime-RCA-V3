import { useMemo } from 'react';
import { useEventPickerPage } from '@/api/v2/queries/rca-pickers';
import type { ProductionEventView } from '@/api/v2/types/events';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { humanize } from '@/features/ux-kit/labels';
import { hasWindow, pickerWindow, type LinkPickerFilters } from '../model/link-picker';
import { useRcaFormat } from '../use-rca-format';
import { useUnitNames } from '../use-unit-names';
import { LinkRowButton, type PickerProps } from './link-row-button';

interface Context extends Pick<PickerProps, 'onLink' | 'busy' | 'linkedIds'> {
  dateTime: (value: string | null) => string;
  unitName: (id: string | null) => string;
}

function columnsOf(context: Context): DataTableColumn<ProductionEventView>[] {
  return [
    { id: 'start', header: 'Start', cell: (event) => context.dateTime(event.startTime), nowrap: true },
    { id: 'unit', header: 'Unit', cell: (event) => context.unitName(event.unitId) },
    { id: 'kind', header: 'Kind', cell: (event) => humanize(event.classification.physicalType) },
    { id: 'description', header: 'Description', cell: (event) => <span className="line-clamp-2">{event.description ?? '—'}</span> },
    {
      id: 'link',
      header: <span className="sr-only">Link</span>,
      cell: (event) => <LinkRowButton targetId={event.id} label={`Link event from ${context.dateTime(event.startTime)}`} {...context} />,
    },
  ];
}

/** Production events of the window (`GET /v2/production-events`), newest first; "Link" adds one with its evidence package. */
export function EventLinkPicker({ filters, onLink, busy, linkedIds }: PickerProps & { filters: LinkPickerFilters }) {
  const { dateTime, timezone } = useRcaFormat();
  const { unitName } = useUnitNames();
  const paged = useEventPickerPage({
    ...(hasWindow(filters) ? pickerWindow(filters, timezone) : {}),
    unitIds: filters.unitId ? [filters.unitId] : undefined,
    reasonIds: filters.reasonCodeId ? [filters.reasonCodeId] : undefined,
    q: filters.q.trim() || undefined,
  });
  const columns = useMemo(() => columnsOf({ dateTime, unitName, onLink, busy, linkedIds }), [dateTime, unitName, onLink, busy, linkedIds]);
  return (
    <div data-testid="event-link-picker">
      <DataTable
        caption="Production events"
        columns={columns}
        rows={paged.rows}
        getRowKey={(event) => event.id}
        pager={paged.pager}
        status={paged.status}
        empty={{ title: 'No events', text: 'No production event matches these filters.' }}
      />
    </div>
  );
}
