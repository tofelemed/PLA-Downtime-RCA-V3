import type { DowntimeGroupView } from '@/api/v2/types/reports';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { DurationText } from '@/features/ux-kit/duration-text';
import type { DowntimeBundleResult } from '../hooks/use-downtime-bundle';
import { viewOf, type PageViews } from '../model/bundle-views';
import { formatCount, formatRatio } from '../model/kpi-display';
import { ReportCard } from './report-card';

/** Downtime per crew of the shift instances (calendar crews, D03), with the server's share. */
export function CrewComparison({ bundle, views }: { bundle: DowntimeBundleResult; views: PageViews }) {
  const { digits, number } = useNumberFormat();
  const view = viewOf(bundle.data?.data, views.crew);
  const groups = view?.groups ?? [];
  const isCount = view?.unit === 'count';
  const columns: DataTableColumn<DowntimeGroupView>[] = [
    { id: 'crew', header: 'Crew', cell: (group) => <span data-testid="crew-row">{group.label ?? (group.key ? 'Unknown crew' : 'No crew')}</span> },
    {
      id: 'value',
      header: isCount ? 'Stops' : 'Downtime',
      align: 'right',
      nowrap: true,
      cell: (group) => (isCount ? formatCount(group.value, digits) : <DurationText seconds={group.value} />),
    },
    { id: 'share', header: 'Share', align: 'right', cell: (group) => formatRatio(group.share, 1, digits) },
    { id: 'periods', header: 'Periods', align: 'right', cell: (group) => number(group.periods) },
  ];
  return (
    <ReportCard
      title="Crew comparison"
      testId="crew-comparison"
      query={bundle}
      response={bundle.data}
      showMeta={false}
      isEmpty={groups.length === 0}
      note="Crew of the shift each period belongs to; periods without a crew rotation are “No crew”."
    >
      <DataTable caption="Downtime by crew" columns={columns} rows={groups} getRowKey={(group) => group.key ?? 'none'} density="compact" />
    </ReportCard>
  );
}
