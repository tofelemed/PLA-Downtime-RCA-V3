import { useCodingCompliance } from '@/api/v2/queries/ops-reports';
import type { ComplianceRowView } from '@/api/v2/types/ops-reports';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { AnalyticsCard } from '@/features/pla-analytics/components/analytics-card';
import { scopeBase, type AnalyticsScope } from '@/features/pla-analytics/model/analytics-scope';
import { kpiText } from '@/features/pla-analytics/model/display';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { DurationText } from '@/features/ux-kit/duration-text';
import { LocalizedNumber } from '@/features/ux-kit/localized-number';
import { NumberText } from '@/features/ux-kit/number-text';
import { useCalendarPreference } from '@/lib/dates';
import { EventStatusCard } from '../daily/event-status-card';

const delay = (seconds: string | null) => (seconds === null ? '—' : <DurationText seconds={seconds} />);

function useColumns(groupTitle: string): Array<DataTableColumn<ComplianceRowView>> {
  const { digits } = useCalendarPreference();
  return [
    { id: 'name', header: groupTitle, cell: (r) => <span data-testid="compliance-row">{r.label ?? (r.key ? r.key : 'Not recorded')}</span> },
    { id: 'stops', header: 'Stops', align: 'right', cell: (r) => <NumberText value={r.stops} /> },
    { id: 'coded', header: 'Coded', align: 'right', cell: (r) => <NumberText value={r.coded} /> },
    { id: 'verified', header: 'Verified', align: 'right', cell: (r) => <NumberText value={r.verified} /> },
    { id: 'median', header: 'Coding delay (median)', align: 'right', nowrap: true, cell: (r) => delay(r.medianDelaySeconds) },
    { id: 'p90', header: 'Coding delay (90 %)', align: 'right', nowrap: true, cell: (r) => delay(r.p90DelaySeconds) },
    { id: 'codedShare', header: 'Downtime coded', align: 'right', nowrap: true, cell: (r) => <LocalizedNumber text={kpiText(r.codedDowntimeRatio, digits)} /> },
    { id: 'coverage', header: 'Known state', align: 'right', nowrap: true, cell: (r) => <LocalizedNumber text={kpiText(r.stateCoverage, digits)} /> },
  ];
}

function ComplianceTable({ rows, title }: { rows: readonly ComplianceRowView[]; title: string }) {
  const columns = useColumns(title);
  return <DataTable caption={`Coding by ${title.toLowerCase()}`} columns={columns} rows={[...rows]} getRowKey={(r) => r.key ?? '-'} density="compact" />;
}

/**
 * Data quality and coding compliance (R9, shift supervisor, plant manager): per crew and shift, how many
 * stops are coded and verified, how long coding takes after a stop ends, the coded share of downtime and
 * the share of time with a known equipment state — what makes every other report trustworthy.
 */
export function CodingComplianceReport({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const query = useCodingCompliance(scopeBase(scope), env.timezone);
  const data = query.data?.data;
  const empty = data !== undefined && data.byCrew.length === 0 && data.byShift.length === 0;
  return (
    <div className="space-y-4" data-testid="coding-compliance">
      <AnalyticsCard title="Coding by crew and shift" testId="coding-compliance-tables" query={query} response={query.data} approvedOnly={scope.approvedOnly} isEmpty={empty} emptyText="No stops or calculated periods on these dates." note="Coding delay: from the end of a stop to its first coding with a reason.">
        {data && (
          <div className="space-y-4">
            <ComplianceTable rows={data.byCrew} title="Crew" />
            <ComplianceTable rows={data.byShift} title="Shift" />
          </div>
        )}
      </AnalyticsCard>
      <EventStatusCard scope={scope} />
    </div>
  );
}
