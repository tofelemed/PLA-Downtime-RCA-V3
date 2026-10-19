import { useCalendarPreference } from '@/lib/dates';
import { useReliabilityReport } from '@/api/v2/queries/reports';
import type { ReliabilityRowView } from '@/api/v2/types/reports';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DurationText } from '@/features/ux-kit/duration-text';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { reportBase, type DowntimeFilters } from '../model/downtime-filters';
import { formatCount, reasonText, REPAIR_COLUMNS } from '../model/kpi-display';
import { DataCoverageNote } from './data-coverage-note';
import { ReportCard } from './report-card';

/**
 * Reliability per unit (KPI07 / KPI08, D13): MTBF = exposure ÷ failures from the server, null with the
 * exposure when there were no failures; mean active repair time (from work-order evidence) and mean time
 * to restore production (the full outage) side by side (SME D10).
 */
export function ReliabilityCard({ filters }: { filters: DowntimeFilters }) {
  const env = useEventHubEnv();
  const query = useReliabilityReport(reportBase(filters), env.timezone);
  const rows = query.data?.data.units ?? [];
  return (
    <ReportCard
      title="Reliability"
      testId="reliability"
      query={query}
      response={query.data}
      isEmpty={rows.length === 0}
      note={query.data?.data.failureDefinition}
    >
      <DataCoverageNote coverage={query.data?.data.dataCoverage} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Unit</TableHead>
            <TableHead>MTBF</TableHead>
            <TableHead>Failures</TableHead>
            {REPAIR_COLUMNS.map((column) => (
              <TableHead key={column.testId}>
                <span data-testid={column.testId}>{column.title}</span>
                <span className="block text-xs font-normal text-muted-foreground">{column.note}</span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <ReliabilityRow key={row.unitId} row={row} unitName={env.unitName(row.unitId)} />
          ))}
        </TableBody>
      </Table>
    </ReportCard>
  );
}

function ReliabilityRow({ row, unitName }: { row: ReliabilityRowView; unitName: string }) {
  const { digits } = useCalendarPreference();
  return (
    <TableRow data-testid="reliability-row" data-unit-id={row.unitId}>
      <TableCell>{unitName}</TableCell>
      <TableCell data-testid="mtbf">
        {row.mtbf.value !== null ? (
          <DurationText seconds={row.mtbf.value} />
        ) : (
          <span>
            {reasonText(row.mtbf.reason)} · exposure <DurationText seconds={row.exposureSeconds} />
          </span>
        )}
      </TableCell>
      <TableCell>{formatCount(row.failures, digits)}</TableCell>
      {REPAIR_COLUMNS.map((column) => {
        const view = column.view(row);
        return <TableCell key={column.testId}>{view.value !== null ? <DurationText seconds={view.value} /> : reasonText(view.reason)}</TableCell>;
      })}
    </TableRow>
  );
}
