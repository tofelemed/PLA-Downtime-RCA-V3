import { type DigitSystem, useCalendarPreference } from '@/lib/dates';
import { useReliabilityReport } from '@/api/v2/queries/reports';
import type { ReliabilityRowView } from '@/api/v2/types/reports';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { DurationText } from '@/features/ux-kit/duration-text';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { reportBase, type DowntimeFilters } from '../model/downtime-filters';
import { formatCount, reasonText, REPAIR_COLUMNS } from '../model/kpi-display';
import { DataCoverageNote } from './data-coverage-note';
import { ReportCard } from './report-card';

/** A column title with what it measures behind its ⓘ (no caption under the header). */
function InfoHeader({ title, info, testId }: { title: string; info: string; testId?: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span data-testid={testId}>{title}</span>
      <KpiInfo label={title} text={info} />
    </span>
  );
}

function MtbfCell({ row }: { row: ReliabilityRowView }) {
  return (
    <span data-testid="mtbf">
      {row.mtbf.value !== null ? (
        <DurationText seconds={row.mtbf.value} />
      ) : (
        <>
          {reasonText(row.mtbf.reason)} · exposure <DurationText seconds={row.exposureSeconds} />
        </>
      )}
    </span>
  );
}

function columnsFor(unitName: (id: string) => string, digits: DigitSystem): DataTableColumn<ReliabilityRowView>[] {
  return [
    { id: 'unit', header: 'Unit', cell: (row) => <span data-testid="reliability-row" data-unit-id={row.unitId}>{unitName(row.unitId)}</span> },
    { id: 'mtbf', header: <InfoHeader title="MTBF" info="Mean time between failures: exposure ÷ failures" />, headerLabel: 'MTBF', cell: (row) => <MtbfCell row={row} /> },
    { id: 'failures', header: 'Failures', align: 'right', nowrap: true, cell: (row) => formatCount(row.failures, digits) },
    ...REPAIR_COLUMNS.map((column) => ({
      id: column.testId,
      header: <InfoHeader title={column.title} info={column.note} testId={column.testId} />,
      headerLabel: column.title,
      nowrap: true,
      cell: (row: ReliabilityRowView) => {
        const view = column.view(row);
        return view.value !== null ? <DurationText seconds={view.value} /> : reasonText(view.reason);
      },
    })),
  ];
}

/**
 * Reliability per unit (KPI07 / KPI08, D13): MTBF = exposure ÷ failures from the server, null with the
 * exposure when there were no failures; mean active repair time (from work-order evidence) and mean time
 * to restore production (the full outage) side by side (SME D10). The failure definition is the title ⓘ.
 */
export function ReliabilityCard({ filters }: { filters: DowntimeFilters }) {
  const env = useEventHubEnv();
  const { digits } = useCalendarPreference();
  const query = useReliabilityReport(reportBase(filters), env.timezone);
  const rows = query.data?.data.units ?? [];
  return (
    <ReportCard title="Reliability" testId="reliability" query={query} response={query.data} isEmpty={rows.length === 0} info={query.data?.data.failureDefinition}>
      <DataCoverageNote coverage={query.data?.data.dataCoverage} />
      <DataTable caption="Reliability by unit" columns={columnsFor(env.unitName, digits)} rows={rows} getRowKey={(row) => row.unitId} pager="none" />
    </ReportCard>
  );
}
