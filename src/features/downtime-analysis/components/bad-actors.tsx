import type { DowntimeGroupView } from '@/api/v2/types/reports';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { DurationText } from '@/features/ux-kit/duration-text';
import type { DowntimeBundleResult } from '../hooks/use-downtime-bundle';
import { viewOf, type PageViews } from '../model/bundle-views';
import { formatCount, formatRatio } from '../model/kpi-display';
import { ReportCard } from './report-card';

interface ActorRow {
  group: DowntimeGroupView;
  stops: string | undefined;
}

const columns: DataTableColumn<ActorRow>[] = [
  { id: 'asset', header: 'Asset', cell: (row) => row.group.label ?? (row.group.key ? 'Unknown asset' : 'No asset') },
  {
    id: 'downtime',
    header: 'Downtime',
    align: 'right',
    nowrap: true,
    cell: (row) => (
      <span data-testid="bad-actor" data-key={row.group.key ?? ''} data-value={row.group.value}>
        <DurationText seconds={row.group.value} variant="compact" />
      </span>
    ),
  },
  { id: 'share', header: 'Share', align: 'right', nowrap: true, cell: (row) => formatRatio(row.group.share) },
  { id: 'stops', header: 'Stops', align: 'right', nowrap: true, cell: (row) => (row.stops === undefined ? '—' : formatCount(row.stops)) },
];

/**
 * Asset bad actors (AN01): downtime per asset, largest first, with the stop count beside it — both
 * from the page snapshot. The breakdown is allocated: where stops of several assets overlap, each
 * moment is shared, so the asset rows add up to the unit downtime (decision 2.7).
 */
export function BadActors({ bundle, views }: { bundle: DowntimeBundleResult; views: PageViews }) {
  const duration = viewOf(bundle.data?.data, views.assetDuration);
  const frequency = viewOf(bundle.data?.data, views.assetFrequency);
  const stops = new Map((frequency?.groups ?? []).map((group) => [group.key, group.value]));
  const rows = (duration?.groups ?? []).map((group) => ({ group, stops: stops.get(group.key) }));
  return (
    <ReportCard
      title="Asset bad actors"
      testId="bad-actors"
      query={bundle}
      response={bundle.data}
      showMeta={false}
      isEmpty={rows.length === 0}
      note="Allocated: overlapping stops of several assets share each moment, so asset totals add up to the unit downtime. Stops without an asset are listed as “No asset”."
    >
      <DataTable caption="Downtime by asset" columns={columns} rows={rows} getRowKey={(row) => row.group.key ?? 'none'} density="compact" />
    </ReportCard>
  );
}
