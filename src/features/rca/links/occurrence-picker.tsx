import { useMemo } from 'react';
import { useRcaOccurrencePage } from '@/api/v2/queries/rca-pickers';
import type { RcaOccurrenceView } from '@/api/v2/types/rca-pickers';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { hasWindow, pickerWindow, type LinkPickerFilters } from '../model/link-picker';
import { useRcaFormat } from '../use-rca-format';
import { useUnitNames } from '../use-unit-names';
import { LinkRowButton, type PickerProps } from './link-row-button';

interface Context extends Pick<PickerProps, 'onLink' | 'busy' | 'linkedIds'> {
  dateTime: (value: string | null) => string;
  unitName: (id: string | null) => string;
  number: (value: number) => string;
}

function columnsOf(context: Context): DataTableColumn<RcaOccurrenceView>[] {
  return [
    { id: 'start', header: 'Start', cell: (row) => context.dateTime(row.startTime), nowrap: true },
    { id: 'unit', header: 'Unit', cell: (row) => context.unitName(row.unitId) },
    { id: 'asset', header: 'Asset', cell: (row) => row.assetName ?? <span className="text-muted-foreground">No asset</span> },
    { id: 'reason', header: 'Reason', cell: (row) => row.reasonName ?? <span className="text-muted-foreground">Not coded</span> },
    { id: 'description', header: 'Description', cell: (row) => <span className="line-clamp-2">{row.description ?? '—'}</span> },
    { id: 'events', header: 'Events', cell: (row) => context.number(row.eventCount), align: 'right' },
    {
      id: 'link',
      header: <span className="sr-only">Link</span>,
      cell: (row) => <LinkRowButton targetId={row.occurrenceId} label={`Link occurrence from ${context.dateTime(row.startTime)}`} {...context} />,
    },
  ];
}

/**
 * Stop occurrences (`GET /v2/occurrences`), newest first; the server needs a window of at most 366 days,
 * so nothing is asked until both days are chosen.
 */
export function OccurrencePicker({ filters, onLink, busy, linkedIds }: PickerProps & { filters: LinkPickerFilters }) {
  const { dateTime, timezone } = useRcaFormat();
  const { unitName } = useUnitNames();
  const { number } = useNumberFormat();
  const ready = hasWindow(filters);
  const paged = useRcaOccurrencePage(
    {
      ...(ready ? pickerWindow(filters, timezone) : {}),
      unitId: filters.unitId || undefined,
      reasonCodeId: filters.reasonCodeId || undefined,
      q: filters.q.trim() || undefined,
    },
    ready,
  );
  const columns = useMemo(() => columnsOf({ dateTime, unitName, number, onLink, busy, linkedIds }), [dateTime, unitName, number, onLink, busy, linkedIds]);
  return (
    <div data-testid="occurrence-picker">
      <DataTable
        caption="Stop occurrences"
        columns={columns}
        rows={paged.rows}
        getRowKey={(row) => row.occurrenceId}
        pager={paged.pager}
        status={ready ? paged.status : undefined}
        empty={{ title: 'No occurrences', text: ready ? 'No stop occurrence matches these filters.' : 'Choose a From and a To day.' }}
      />
    </div>
  );
}
