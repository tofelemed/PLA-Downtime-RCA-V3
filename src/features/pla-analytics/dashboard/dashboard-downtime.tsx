import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDowntimeReport } from '@/api/v2/queries/reports';
import type { DowntimeReportView } from '@/api/v2/types/reports';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import type { KpiAggregateView } from '@/api/v2/types/reports';
import { DurationText } from '@/features/ux-kit/duration-text';
import { NumberText } from '@/features/ux-kit/number-text';
import { useCalendarPreference } from '@/lib/dates';
import { CONTROLLABLE_TILE, findMetric, formatCount, formatRatio, reasonText, SUMMARY_TILES, type TileSpec } from '@/features/downtime-analysis/model/kpi-display';
import { ControllableSwitch } from '@/features/downtime-analysis/components/controllable-switch';
import { AnalyticsCard } from '../components/analytics-card';
import { repeatQuery, type AnalyticsScope } from '../model/analytics-scope';
import { SCHEDULED_AVAILABILITY_CAPTION } from './availability-captions';
import { assetStopsHref, downtimeHref, plaHref } from './dashboard-links';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

const DASHBOARD_TILES = SUMMARY_TILES.filter((tile) => ['downtime_total', 'downtime_unplanned', 'stop_count', 'scheduled_availability'].includes(tile.metric)).map((tile) =>
  tile.metric === 'scheduled_availability' ? { ...tile, note: SCHEDULED_AVAILABILITY_CAPTION } : tile,
);
const TOP = 5;

function TileValue({ spec, view }: { spec: TileSpec; view: KpiAggregateView }) {
  const { digits } = useCalendarPreference();
  if (spec.kind === 'duration') return <DurationText seconds={view.value} />;
  return <>{spec.kind === 'ratio' ? formatRatio(view.value, 1, digits) : formatCount(view.value, digits)}</>;
}

/** One downtime KPI: the server value with its definition, or "—" with the server's reason (no per-tile status). */
function DowntimeTile({ spec, view }: { spec: TileSpec; view: KpiAggregateView | undefined }) {
  return (
    <div className="rounded-md border p-3" data-testid={`kpi-${spec.metric}`} data-value={view?.value ?? ''}>
      <dt className="text-xs text-muted-foreground">{spec.title}</dt>
      <dd className="text-xl font-semibold" data-testid="kpi-value">
        {view && view.value !== null ? <TileValue spec={spec} view={view} /> : '—'}
      </dd>
      <dd className="text-xs text-muted-foreground">{view && view.value === null ? reasonText(view.reason) ?? 'Not available' : spec.note}</dd>
    </div>
  );
}

/** Downtime of the window: total, unplanned, stops and scheduled availability (server KPIs). */
export function DashboardDowntime({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const query = useDowntimeReport(repeatQuery(scope, 'reason'), env.timezone);
  const summary = query.data?.data.summary;
  const [controllable, setControllable] = useState(false);
  const tiles = controllable ? [...DASHBOARD_TILES, CONTROLLABLE_TILE] : DASHBOARD_TILES;
  const actions = (
    <div className="flex flex-wrap items-center gap-3">
      <ControllableSwitch checked={controllable} onChange={setControllable} testId="dashboard-controllable-switch" />
      <Link className="text-sm underline" to={downtimeHref(scope)}>
        Downtime analysis
      </Link>
    </div>
  );
  return (
    <AnalyticsCard title="Downtime totals" testId="dashboard-downtime" query={query} response={query.data} actions={actions}>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <DowntimeTile key={tile.metric} spec={tile} view={findMetric(summary, tile.metric)} />
        ))}
      </dl>
    </AnalyticsCard>
  );
}

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
