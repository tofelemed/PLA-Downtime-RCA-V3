import { Link } from 'react-router-dom';
import { useDowntimeReport } from '@/api/v2/queries/reports';
import type { DowntimeReportView } from '@/api/v2/types/reports';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { NumberText } from '@/features/ux-kit/number-text';
import { AnalyticsCard } from '../components/analytics-card';
import { repeatQuery, type AnalyticsScope } from '../model/analytics-scope';
import { assetStopsHref, plaHref } from './dashboard-links';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

const TOP = 5;

type Group = DowntimeReportView['groups'][number];

const assetName = (group: Group) => group.label ?? (group.key ? 'Unknown asset' : 'No asset recorded');

/** An asset row opens its stops in the Event Hub over the same window. */
function assetColumns(scope: AnalyticsScope): Array<DataTableColumn<Group>> {
  return [
    {
      id: 'asset',
      header: 'Asset',
      cell: (group) => (group.key ? <Link className="underline" to={assetStopsHref(scope, group.key)}>{assetName(group)}</Link> : assetName(group)),
    },
    { id: 'stops', header: 'Stops', align: 'right', cell: (group) => <NumberText value={group.value} /> },
    { id: 'periods', header: 'Shifts', align: 'right', cell: (group) => <NumberText value={group.periods} /> },
  ];
}

/** The assets with the most stops in the window (the top 5; the full list is under Losses → Repeat causes). */
export function DashboardTopAssets({ scope }: { scope: AnalyticsScope }) {
  const { number } = useNumberFormat();
  const env = useEventHubEnv();
  const query = useDowntimeReport(repeatQuery(scope, 'asset'), env.timezone);
  const groups = query.data?.data.groups ?? [];
  const link = plaHref(scope, '/pla-analytics/losses', { breakdown: 'repeat-causes' });
  return (
    <AnalyticsCard
      title={`Most stopped assets (top ${TOP})`}
      testId="dashboard-top-assets"
      query={query}
      response={query.data}
      isEmpty={groups.length === 0}
      emptyText="No stops on assets in this window."
      actions={<Link className="text-sm underline" to={link}>All repeat causes</Link>}
    >
      <DataTable caption="Most stopped assets" columns={assetColumns(scope)} rows={groups.slice(0, TOP)} getRowKey={(group) => group.key ?? '-'} pager="none" density="compact" />
      {groups.length > TOP && <p className="text-xs text-muted-foreground">{number(groups.length - TOP)} more assets with stops: see all repeat causes.</p>}
    </AnalyticsCard>
  );
}
