import { useMemo } from 'react';
import { useConnectionExternalReports } from '@/api/v2/queries/external-reports';
import type { ExternalReportV2View } from '@/api/v2/types/external-reports';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { useNumberFormat, type NumberFormat } from '@/features/ux-kit/use-number-format';
import { formatOperationalDate, useCalendarPreference } from '@/lib/dates';

const NOTE = 'A daily report counts as a period actual only when its status is released (Source status rules, source system MQTT) and the plant accounts by day.';
const EMPTY = { title: 'No PLA reports received yet.', text: 'No PLA reports received yet.' };

const STATE_LABELS: Readonly<Record<string, string>> = { current: 'Current', superseded: 'Superseded' };

function tonnes(value: number | string | null | undefined, format: NumberFormat): string {
  if (value === null || value === undefined || value === '') return '—';
  return typeof value === 'number' ? format.number(value, 2) : format.decimal(value, 2);
}

function columnsOf(format: NumberFormat, dateOf: (iso: string) => string, timezone: string): DataTableColumn<ExternalReportV2View>[] {
  const figure = (row: ExternalReportV2View) => row.sourceFigures;
  return [
    { id: 'date', header: 'Production date', nowrap: true, cell: (row) => dateOf(row.localProductionDate) },
    { id: 'revision', header: 'Revision', align: 'right', nowrap: true, cell: (row) => row.externalRevision },
    { id: 'state', header: 'State', nowrap: true, cell: (row) => STATE_LABELS[row.state] ?? row.state },
    { id: 'planned', header: 'OT planned (t)', align: 'right', nowrap: true, cell: (row) => tonnes(figure(row)?.planned, format) },
    { id: 'actual', header: 'OT actual (t)', align: 'right', nowrap: true, cell: (row) => tonnes(figure(row)?.actual, format) },
    { id: 'shortfall', header: 'OT shortfall (t)', align: 'right', nowrap: true, cell: (row) => tonnes(figure(row)?.shortfall, format) },
    { id: 'status', header: 'OT status', nowrap: true, cell: (row) => figure(row)?.status ?? row.sourceStatus },
    { id: 'released', header: 'Released', nowrap: true, cell: (row) => (row.certifiedEligible ? 'Yes' : 'No') },
    { id: 'imported', header: 'Imported', cell: (row) => <PlantTime iso={row.importedAt} tz={timezone} withDate stacked /> },
  ];
}

/** PLA daily reports this connection's PLA feed received, with OT's own figures for comparison. */
export function PlaReportsTab({ connectionId, timezone }: { connectionId: string; timezone: string }) {
  const list = useConnectionExternalReports(connectionId);
  const format = useNumberFormat();
  const preference = useCalendarPreference();
  const columns = useMemo(() => columnsOf(format, (iso) => formatOperationalDate(iso, preference), timezone), [format, preference, timezone]);
  return (
    <section className="space-y-3" aria-labelledby="pla-reports-title" data-testid="pla-reports">
      <h2 id="pla-reports-title" className="text-base font-semibold text-heading">PLA reports</h2>
      <p className="text-sm text-muted-foreground">{NOTE}</p>
      <DataTable caption="PLA reports" columns={columns} rows={list.rows} getRowKey={(row) => row.id} pager={list.pager} status={list.status} empty={EMPTY} />
    </section>
  );
}
