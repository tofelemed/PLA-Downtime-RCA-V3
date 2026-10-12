import { useDowntimeReport } from '@/api/v2/queries/reports';
import type { DowntimeReportView } from '@/api/v2/types/reports';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { formatCount } from '@/features/downtime-analysis/model/kpi-display';
import { AnalyticsCard } from '../components/analytics-card';
import { repeatQuery, type AnalyticsScope } from '../model/analytics-scope';
import { shareText } from '../model/display';

type Group = DowntimeReportView['groups'][number];

function columnsOf(title: string): Array<DataTableColumn<Group>> {
  return [
    {
      id: 'group',
      header: title,
      cell: (group) => (
        <span data-testid="repeat-row" data-key={group.key ?? ''} data-count={group.value} data-periods={group.periods}>
          {group.label ?? (group.key ? 'Unknown' : 'Not coded')}
        </span>
      ),
    },
    { id: 'stops', header: 'Stops', align: 'right', cell: (group) => formatCount(group.value) },
    { id: 'periods', header: 'Periods', align: 'right', cell: (group) => group.periods },
    { id: 'cumulative', header: 'Cumulative', align: 'right', nowrap: true, cell: (group) => shareText(group.cumulativeShare) },
  ];
}

function RepeatTable({ report, title, testId }: { report: DowntimeReportView; title: string; testId: string }) {
  return (
    <div data-testid={testId}>
      <DataTable caption={`Repeat causes by ${title.toLowerCase()}`} columns={columnsOf(title)} rows={report.groups} getRowKey={(group) => group.key ?? '-'} density="compact" />
    </div>
  );
}

/**
 * Repeat causes (AN02): stop occurrences per reason and per asset with the number of periods each one
 * recurs in — the 2.7 downtime report with `metric=frequency`, ordered by the server (Pareto).
 */
export function RepeatCausesTab({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const byReason = useDowntimeReport(repeatQuery(scope, 'reason'), env.timezone);
  const byAsset = useDowntimeReport(repeatQuery(scope, 'asset'), env.timezone);
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <AnalyticsCard title="By reason" testId="pla-repeat-reasons" query={byReason} response={byReason.data} isEmpty={byReason.data?.data.groups.length === 0} emptyText="No stops in this scope." note="Stops starting in the window; “periods” = shifts the cause recurred in.">
        {byReason.data && <RepeatTable report={byReason.data.data} title="Reason" testId="repeat-reasons" />}
      </AnalyticsCard>
      <AnalyticsCard title="By asset" testId="pla-repeat-assets" query={byAsset} response={byAsset.data} isEmpty={byAsset.data?.data.groups.length === 0} emptyText="No stops on assets in this scope." note="Allocated to the asset of the stop.">
        {byAsset.data && <RepeatTable report={byAsset.data.data} title="Asset" testId="repeat-assets" />}
      </AnalyticsCard>
    </div>
  );
}
