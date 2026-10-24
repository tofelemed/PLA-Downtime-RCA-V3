import { useReliabilityTrend } from '@/api/v2/queries/ops-reports';
import type { ReliabilitySeriesView } from '@/api/v2/types/ops-reports';
import type { KpiAggregateView } from '@/api/v2/types/reports';
import { Badge } from '@/components/ui/badge';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { AnalyticsCard } from '@/features/pla-analytics/components/analytics-card';
import { scopeBase, type AnalyticsScope } from '@/features/pla-analytics/model/analytics-scope';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { DurationText } from '@/features/ux-kit/duration-text';
import { ProvisionalMark } from '@/features/ux-kit/report-look';
import { monthLabelOf } from '@/features/month-close/model/month-label';
import { useCalendarPreference } from '@/lib/dates';
import { ReportExportBar } from '../components/report-export-bar';

type Metric = 'mtbf' | 'meanDowntimeToRestore' | 'mttr';

const METRICS: ReadonlyArray<{ key: Metric; label: string }> = [
  { key: 'mtbf', label: 'MTBF' },
  { key: 'meanDowntimeToRestore', label: 'Mean time to restore' },
  { key: 'mttr', label: 'MTTR (repair evidence)' },
];

function Figure({ view }: { view: KpiAggregateView | undefined }) {
  if (view?.value == null) return <span className="text-muted-foreground">—</span>;
  return (
    <>
      <DurationText seconds={view.value} />
      <ProvisionalMark when={view.quality === 'provisional'} />
    </>
  );
}

function useColumns(months: readonly string[], metric: Metric, labelOf: (s: ReliabilitySeriesView) => string): Array<DataTableColumn<ReliabilitySeriesView>> {
  const pref = useCalendarPreference();
  return [
    {
      id: 'name',
      header: 'Unit / asset',
      cell: (s) => (
        <span data-testid="reliability-series" data-falling={s.fallingMtbf}>
          {labelOf(s)}
          {metric === 'mtbf' && s.fallingMtbf && <Badge variant="destructive" className="ml-2">MTBF falling</Badge>}
        </span>
      ),
    },
    ...months.map((month): DataTableColumn<ReliabilitySeriesView> => ({
      id: month,
      header: monthLabelOf(month, pref.calendar, pref.digits),
      align: 'right',
      nowrap: true,
      cell: (s) => <Figure view={s.months.find((m) => m.month === month)?.row[metric]} />,
    })),
  ];
}

function SeriesTable({ rows, months, metric, labelOf, caption }: { rows: readonly ReliabilitySeriesView[]; months: readonly string[]; metric: Metric; labelOf: (s: ReliabilitySeriesView) => string; caption: string }) {
  const columns = useColumns(months, metric, labelOf);
  return <DataTable caption={caption} columns={columns} rows={[...rows]} getRowKey={(s) => `${s.unitId}|${s.assetId ?? '-'}`} density="compact" />;
}

/**
 * Reliability trend (R6, reliability engineer): MTBF, mean time to restore and MTTR per plant month for each
 * unit and its most-failing assets, the server's sums of the stored terms; "MTBF falling" where MTBF fell in
 * each of the last three months.
 */
export function ReliabilityTrendReport({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const query = useReliabilityTrend(scopeBase(scope), env.timezone);
  const data = query.data?.data;
  const unitLabel = (s: ReliabilitySeriesView) => env.unitName(s.unitId) ?? 'Unknown unit';
  const assetLabel = (s: ReliabilitySeriesView) => `${s.label ?? 'Unknown asset'} · ${env.unitName(s.unitId) ?? ''}`;
  return (
    <div className="space-y-4" data-testid="reliability-trend">
      <ReportExportBar kind="reliability" query={scopeBase(scope)} timezone={env.timezone} />
      {METRICS.map((metric) => (
        <AnalyticsCard key={metric.key} title={`${metric.label} by month`} testId={`reliability-trend-${metric.key}`} query={query} response={query.data} approvedOnly={scope.approvedOnly} isEmpty={data !== undefined && data.units.length === 0} emptyText="No calculated periods on these dates." info={metric.key === 'mtbf' ? data?.failureDefinition : undefined} provisionalRows>
          {data && (
            <div className="space-y-3">
              <SeriesTable rows={data.units} months={data.months} metric={metric.key} labelOf={unitLabel} caption={`${metric.label} by unit and month`} />
              {data.assets.length > 0 && <SeriesTable rows={data.assets} months={data.months} metric={metric.key} labelOf={assetLabel} caption={`${metric.label} by asset and month`} />}
            </div>
          )}
        </AnalyticsCard>
      ))}
    </div>
  );
}
