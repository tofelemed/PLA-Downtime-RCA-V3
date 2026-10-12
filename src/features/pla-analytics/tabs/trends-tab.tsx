import { lazy, Suspense, useMemo } from 'react';
import { useProducts } from '@/api/v2/queries/profiles';
import { useOeeReport } from '@/api/v2/queries/reports';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import type { TrendGroup } from '@/api/v2/types/pla-analytics';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { useCalendarPreference } from '@/lib/dates';
import { oeeQuery, TREND_GROUPS, type AnalyticsScope, type OeePolicy } from '../model/analytics-scope';
import { bucketLabel } from '../model/buckets';
import { OEE_METRIC_LABELS, TREND_LABELS } from '../model/display';
import { oeeRows } from '../model/series';
import { AnalyticsCard } from '../components/analytics-card';
import { SELECT_CLASS } from '../components/analytics-filters';
import { OeeGroupTable } from '../components/oee-group-table';
import { ResidualTrendCard } from '../components/residual-trend-card';

const SeriesChart = lazy(() => import('../charts/series-chart').then((m) => ({ default: m.SeriesChart })));

export interface TrendsTabProps {
  scope: AnalyticsScope;
  onChange: (patch: Partial<AnalyticsScope>) => void;
}

/**
 * Trends (AN02 / AN03, B11): the trend selector sets the server `groupBy` (site-local shift, day, week or
 * month); OEE per bucket with its policy label, unaccounted / over-accounted per bucket, and OEE per unit
 * and per product with names from the reference lists.
 */
export function TrendsTab({ scope, onChange }: TrendsTabProps) {
  const env = useEventHubEnv();
  const products = useProducts();
  const productName = useMemo(() => {
    const names = new Map(flattenPages(products.data?.pages).map((p) => [p.id, p.name]));
    return (key: string | null) => (key ? names.get(key) ?? 'Unknown product' : 'No product');
  }, [products.data]);
  const trend = useOeeReport(oeeQuery(scope, scope.trendBy), env.timezone);
  const byUnit = useOeeReport(oeeQuery(scope, 'unit'), env.timezone);
  const byProduct = useOeeReport(oeeQuery(scope, 'product'), env.timezone);
  const report = trend.data?.data;
  const pref = useCalendarPreference();
  const label = (key: string | null) => bucketLabel(key, scope.trendBy, pref);
  const controls = (
    <div className="flex flex-wrap items-center gap-2">
      <Label htmlFor="trend-by">Trend by</Label>
      <select id="trend-by" data-testid="trend-by" className={SELECT_CLASS} value={scope.trendBy} onChange={(e) => onChange({ trendBy: e.target.value as TrendGroup })}>
        {TREND_GROUPS.map((g) => (
          <option key={g} value={g}>
            {TREND_LABELS[g]}
          </option>
        ))}
      </select>
      <Label htmlFor="trend-policy">OEE</Label>
      <select id="trend-policy" data-testid="trend-policy" className={SELECT_CLASS} value={scope.policy} onChange={(e) => onChange({ policy: e.target.value as OeePolicy })}>
        <option value="operational">Operational OEE (ISO 22400)</option>
        <option value="reconciled">Reconciled PLA OEE (labelled)</option>
      </select>
    </div>
  );
  return (
    <div className="space-y-4">
      <AnalyticsCard title={`${report?.label ?? 'OEE'} by ${TREND_LABELS[scope.trendBy].toLowerCase()}`} testId="pla-oee-trend" query={trend} response={trend.data} isEmpty={report?.groups.length === 0} actions={controls} note="Buckets use the plant's operational date and shift; each value is the sum of numerators over the sum of denominators.">
        {report && (
          <div data-testid="oee-trend" data-group-by={report.groupBy} data-policy={report.policy}>
            <Suspense fallback={<Skeleton className="h-64 w-full" />}>
              <SeriesChart rows={oeeRows(report, label)} series={report.total.map((t) => ({ key: t.metric, label: OEE_METRIC_LABELS[t.metric.replace('reconciled_', '')] ?? t.metric }))} kind="line" ratio />
            </Suspense>
          </div>
        )}
      </AnalyticsCard>
      <ResidualTrendCard scope={scope} />
      <div className="grid gap-4 xl:grid-cols-2">
        <AnalyticsCard title={`${byUnit.data?.data.label ?? 'OEE'} by unit`} testId="pla-oee-units" query={byUnit} response={byUnit.data} isEmpty={byUnit.data?.data.groups.length === 0}>
          {byUnit.data && <OeeGroupTable report={byUnit.data.data} groupTitle="Unit" labelOf={(key) => env.unitName(key)} testId="oee-by-unit" />}
        </AnalyticsCard>
        <AnalyticsCard title={`${byProduct.data?.data.label ?? 'OEE'} by product`} testId="pla-oee-products" query={byProduct} response={byProduct.data} isEmpty={byProduct.data?.data.groups.length === 0}>
          {byProduct.data && <OeeGroupTable report={byProduct.data.data} groupTitle="Product" labelOf={productName} testId="oee-by-product" />}
        </AnalyticsCard>
      </div>
    </div>
  );
}
