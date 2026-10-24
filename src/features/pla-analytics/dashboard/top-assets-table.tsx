import { Link } from 'react-router-dom';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useDowntimeBundle } from '@/features/downtime-analysis/hooks/use-downtime-bundle';
import { viewOf, viewToken } from '@/features/downtime-analysis/model/bundle-views';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { DurationText } from '@/features/ux-kit/duration-text';
import { NumberText } from '@/features/ux-kit/number-text';
import { scopeBase, type AnalyticsScope } from '../model/analytics-scope';
import { assetStopsHref, plaHref } from './dashboard-links';

const TOP = 5;
const STOPS_VIEW = viewToken('asset', 'frequency');
const DURATION_VIEW = viewToken('asset', 'duration');
const VIEWS = [DURATION_VIEW, STOPS_VIEW].sort();

interface AssetRow {
  key: string | null;
  name: string;
  stops: string;
  /** the server's downtime of the same asset, null when it has none */
  downtime: string | null;
}

const assetName = (key: string | null, label: string | null) => label ?? (key ? 'Unknown asset' : 'No asset recorded');

function assetColumns(scope: AnalyticsScope): Array<DataTableColumn<AssetRow>> {
  return [
    { id: 'asset', header: 'Asset', cell: (row) => (row.key ? <Link className="underline" to={assetStopsHref(scope, row.key)}>{row.name}</Link> : row.name) },
    { id: 'stops', header: 'Stops', align: 'right', cell: (row) => <NumberText value={row.stops} /> },
    { id: 'downtime', header: 'Downtime', align: 'right', cell: (row) => (row.downtime === null ? '—' : <DurationText seconds={row.downtime} />) },
  ];
}

/** The assets with the most stops in the window (the top 5) with their downtime: the server's rows joined by asset key. */
export function TopAssetsTable({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const { canViewOperations } = useCapabilities();
  const query = useDowntimeBundle({ ...scopeBase(scope), views: VIEWS }, env.timezone);
  const data = query.data?.data;
  const durations = viewOf(data, DURATION_VIEW)?.groups ?? [];
  const rows = (viewOf(data, STOPS_VIEW)?.groups ?? []).slice(0, TOP).map((group): AssetRow => ({
    key: group.key,
    name: assetName(group.key, group.label),
    stops: group.value,
    downtime: durations.find((other) => other.key === group.key)?.value ?? null,
  }));
  const state = dataStateOf(query, { isEmpty: rows.length === 0 });
  return (
    <div className="space-y-2" data-testid="dashboard-top-assets">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{`Most stopped assets (top ${TOP})`}</h3>
        {canViewOperations && (
          <Link className="text-sm underline" to={plaHref(scope, '/pla-analytics/losses', { breakdown: 'repeat-causes' })}>
            All repeat causes
          </Link>
        )}
      </div>
      <DataState state={state} error={query.error} onRetry={() => query.refetch()} detail="No stops on assets in this window.">
        <DataTable caption="Most stopped assets" columns={assetColumns(scope)} rows={rows} getRowKey={(row) => row.key ?? '-'} pager="none" density="compact" />
      </DataState>
    </div>
  );
}
