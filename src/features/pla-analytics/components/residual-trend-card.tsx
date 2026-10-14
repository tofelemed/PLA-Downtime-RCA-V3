import { lazy, Suspense } from 'react';
import { useReconciliationTrend } from '@/api/v2/queries/pla-analytics';
import type { ReconciliationTrendView } from '@/api/v2/types/pla-analytics';
import { Skeleton } from '@/components/ui/skeleton';
import { type DigitSystem, useCalendarPreference } from '@/lib/dates';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { Quantity } from '@/features/ux-kit/quantity';
import { formatNumber } from '@/features/ux-kit/format/decimal';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { trendQuery, type AnalyticsScope } from '../model/analytics-scope';
import { bucketLabel } from '../model/buckets';
import { TREND_LABELS } from '../model/display';
import { residualRows, trendUnits } from '../model/series';
import { formatRatioPercent } from '@/features/plan-dashboard/model/display';
import { AnalyticsCard } from './analytics-card';

const SeriesChart = lazy(() => import('../charts/series-chart').then((m) => ({ default: m.SeriesChart })));

const SERIES = [
  { key: 'unaccounted', label: 'Unaccounted' },
  { key: 'overAccounted', label: 'Over-accounted' },
  { key: 'overproduction', label: 'Overproduction' },
] as const;

type Bucket = ReconciliationTrendView['buckets'][number];

/** SME R7: unexplained loss against the shortfall, flagged when above the policy's improvement target. */
function UnexplainedShare({ bucket }: { bucket: Bucket }) {
  const { digits } = useCalendarPreference();
  const above = bucket.unexplainedAboveTarget === true;
  const target = bucket.unexplainedTarget === null ? '' : ` (target < ${formatRatioPercent(bucket.unexplainedTarget, digits)})`;
  return (
    <span data-testid="unexplained-share" data-above-target={above ? 'true' : 'false'} className={above ? 'font-medium text-destructive' : undefined} title={`Unexplained loss / shortfall${target}`}>
      {formatRatioPercent(bucket.unexplainedOfShortfall, digits)}
    </span>
  );
}

function columnsOf(label: (key: string) => string, digits: DigitSystem): Array<DataTableColumn<Bucket>> {
  return [
    {
      id: 'bucket',
      header: 'Bucket',
      nowrap: true,
      cell: (b) => (
        <span data-testid="residual-bucket" data-key={b.key} data-unaccounted={b.unaccounted ?? ''}>
          {label(b.key)}
        </span>
      ),
    },
    ...SERIES.map<DataTableColumn<Bucket>>((s) => ({ id: s.key, header: s.label, align: 'right', nowrap: true, cell: (b) => <Quantity value={b[s.key]} uom={b.uom} /> })),
    { id: 'unexplainedOfShortfall', header: 'Unexplained / shortfall', align: 'right', nowrap: true, cell: (b) => <UnexplainedShare bucket={b} /> },
    { id: 'unexplainedOfPlan', header: 'Unexplained / plan', align: 'right', nowrap: true, cell: (b) => formatRatioPercent(b.unexplainedOfPlan, digits) },
    { id: 'periods', header: 'Periods', align: 'right', cell: (b) => formatNumber(b.periods, 0, digits) },
  ];
}

/**
 * Unaccounted and over-accounted trend (AN02): the plan-ledger residual steps of the waterfall per bucket
 * and unit of measure (server `groupBy`), so the buckets add up to the waterfall bars.
 */
export function ResidualTrendCard({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const pref = useCalendarPreference();
  const query = useReconciliationTrend(trendQuery(scope), env.timezone);
  const data = query.data?.data;
  const label = (key: string) => bucketLabel(key, scope.trendBy, pref);
  const columns = columnsOf(label, pref.digits);
  return (
    <AnalyticsCard
      title={`Unaccounted / over-accounted by ${TREND_LABELS[scope.trendBy].toLowerCase()} (plan ledger)`}
      testId="pla-residual-trend"
      query={query}
      response={query.data}
      isEmpty={data?.buckets.length === 0}
      note="After the saved decisions of each period; buckets without a computable slice show —. Unexplained loss counts the open residual, tolerance adjustments and classified Unaccounted lines; it is shown against the shortfall and the plan, in red above the policy's improvement target."
    >
      {data && (
        <div className="space-y-4" data-testid="residual-trend" data-group-by={data.groupBy}>
          {trendUnits(data).map((uom) => (
            <div key={uom ?? '-'} className="space-y-2">
              <Suspense fallback={<Skeleton className="h-64 w-full" />}>
                <SeriesChart rows={residualRows(data, uom).map((row) => ({ ...row, label: label(row.label) }))} series={SERIES} kind="bar" />
              </Suspense>
              <DataTable
                caption={`Residual trend in ${uom ?? 'unknown unit'}`}
                columns={columns}
                rows={data.buckets.filter((b) => b.uom === uom)}
                getRowKey={(b) => `${b.key}|${b.uom ?? ''}`}
                density="compact"
              />
            </div>
          ))}
        </div>
      )}
    </AnalyticsCard>
  );
}
