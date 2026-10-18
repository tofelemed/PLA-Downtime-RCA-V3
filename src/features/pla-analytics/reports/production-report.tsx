import { useDowntimeReport, useOeeReport } from '@/api/v2/queries/reports';
import type { DowntimeReportView } from '@/api/v2/types/reports';
import { formatOperationalDate, useCalendarPreference } from '@/lib/dates';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { DurationText } from '@/features/ux-kit/duration-text';
import { LocalizedNumber } from '@/features/ux-kit/localized-number';
import { NumberText } from '@/features/ux-kit/number-text';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { AnalyticsCard } from '../components/analytics-card';
import { OeeGroupTable } from '../components/oee-group-table';
import { oeeQuery, scopeBase, type AnalyticsScope } from '../model/analytics-scope';
import { shareText } from '../model/display';

/** OEE per plant date (operational, ISO 22400): one row per day the periods start on, 20 per page. */
export function OeeByDay({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const pref = useCalendarPreference();
  const query = useOeeReport(oeeQuery(scope, 'day', 'operational'), env.timezone);
  const data = query.data?.data;
  return (
    <AnalyticsCard title={`${data?.label ?? 'OEE'} by plant date`} testId="report-oee" query={query} response={query.data} isEmpty={data?.groups.length === 0} emptyText="No periods start on these dates.">
      {data && <OeeGroupTable report={data} groupTitle="Plant date" labelOf={(key) => formatOperationalDate(key, pref)} testId="report-oee-days" />}
    </AnalyticsCard>
  );
}

type Group = DowntimeReportView['groups'][number];

const DOWNTIME_COLUMNS: Array<DataTableColumn<Group>> = [
  {
    id: 'reason',
    header: 'Reason',
    cell: (group) => (
      <span data-testid="report-downtime-row" data-key={group.key ?? ''}>
        {group.label ?? (group.key ? 'Unknown' : 'Not coded')}
      </span>
    ),
  },
  { id: 'downtime', header: 'Downtime', align: 'right', nowrap: true, cell: (group) => <DurationText seconds={group.value} /> },
  { id: 'share', header: 'Share', align: 'right', nowrap: true, cell: (group) => <LocalizedNumber text={shareText(group.share)} /> },
  { id: 'periods', header: 'Periods', align: 'right', cell: (group) => <NumberText value={group.periods} /> },
];

/** Downtime by reason: the 2.7 report's allocated seconds per reason in server order (Pareto), 20 per page. */
export function DowntimeReasonCard({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const query = useDowntimeReport({ ...scopeBase(scope), groupBy: 'reason' }, env.timezone);
  const data = query.data?.data;
  return (
    <AnalyticsCard title="Downtime by reason" testId="report-downtime" query={query} response={query.data} isEmpty={data?.groups.length === 0} emptyText="No downtime in these periods.">
      {data && <DataTable caption="Downtime by reason" columns={DOWNTIME_COLUMNS} rows={data.groups} getRowKey={(group) => group.key ?? '-'} density="compact" />}
    </AnalyticsCard>
  );
}
