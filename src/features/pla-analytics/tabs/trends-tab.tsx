import { lazy, Suspense, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProducts } from '@/api/v2/queries/profiles';
import { useOeeReport } from '@/api/v2/queries/reports';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { Skeleton } from '@/components/ui/skeleton';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { useCalendarPreference } from '@/lib/dates';
import { oeeQuery, type AnalyticsScope } from '../model/analytics-scope';
import { bucketLabel } from '../model/buckets';
import { OEE_METRIC_LABELS, TREND_LABELS } from '../model/display';
import { oeeColumnOrder } from '../model/oee-column-order';
import { oeeRows } from '../model/series';
import { AnalyticsCard } from '../components/analytics-card';
import { OeeGroupTable } from '../components/oee-group-table';
import { ResidualTrendCard } from '../components/residual-trend-card';

/** The dashboard's OEE trend colours (chart palette, never the alarm red for Availability). */
const OEE_COLOURS: Readonly<Record<string, string>> = {
  oee: 'hsl(var(--chart-1))',
  availability: 'hsl(var(--chart-8))',
  performance: 'hsl(var(--chart-2))',
  quality: 'hsl(var(--warning))',
};
const BUCKET_INFO = "Buckets are the plant's production dates and shifts; each value is the sum of numerators over the sum of denominators.";

/** The server's OEE series in the order OEE, Availability, Performance, Quality, each in its dashboard colour. */
function oeeSeries(metrics: readonly string[]) {
  return oeeColumnOrder(metrics).map((metric) => {
    const base = metric.replace('reconciled_', '');
    return { key: metric, label: OEE_METRIC_LABELS[base] ?? metric, colour: OEE_COLOURS[base] };
  });
}

const SeriesChart = lazy(() => import('../charts/series-chart').then((module) => ({ default: module.SeriesChart })));
export interface TrendsTabProps { scope: AnalyticsScope; onChange: (patch: Partial<AnalyticsScope>) => void; }

/** Trends page: "Show", "Trend by" and the OEE policy are in the filter bar (ViewPicker). */
export function TrendsTab({ scope }: TrendsTabProps) {
  const [params] = useSearchParams();
  const mode = params.get('series');
  if (mode === 'residual') return <ResidualTrendCard scope={scope} />;
  if (mode === 'units') return <UnitComparison scope={scope} />;
  if (mode === 'products') return <ProductComparison scope={scope} />;
  return <OeeTrend scope={scope} />;
}

function OeeTrend({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const trend = useOeeReport(oeeQuery(scope, scope.trendBy), env.timezone);
  const report = trend.data?.data;
  const pref = useCalendarPreference();
  const label = (key: string | null) => bucketLabel(key, scope.trendBy, pref);
  return <AnalyticsCard title={`${report?.label ?? 'OEE'} by ${TREND_LABELS[scope.trendBy].toLowerCase()}`} testId="pla-oee-trend" query={trend} response={trend.data} isEmpty={report?.groups.length === 0} info={BUCKET_INFO}>
    {report && <div data-testid="oee-trend" data-group-by={report.groupBy} data-policy={report.policy}>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}><SeriesChart rows={oeeRows(report, label)} series={oeeSeries(report.total.map((entry) => entry.metric))} kind="line" ratio valuesTable /></Suspense>
    </div>}
  </AnalyticsCard>;
}

function UnitComparison({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  return <Comparison scope={scope} group="unit" labelOf={(key) => env.unitName(key)} />;
}

function ProductComparison({ scope }: { scope: AnalyticsScope }) {
  const products = useProducts();
  const productName = useMemo(() => {
    const names = new Map(flattenPages(products.data?.pages).map((product) => [product.id, product.name]));
    return (key: string | null) => key ? names.get(key) ?? 'Unknown product' : 'No product';
  }, [products.data]);
  return <Comparison scope={scope} group="product" labelOf={productName} />;
}

function Comparison({ scope, group, labelOf }: { scope: AnalyticsScope; group: 'unit' | 'product'; labelOf: (key: string | null) => string }) {
  const env = useEventHubEnv();
  const query = useOeeReport(oeeQuery(scope, group), env.timezone);
  return <AnalyticsCard title={`${query.data?.data.label ?? 'OEE'} by ${group}`} testId={`pla-oee-${group}s`} query={query} response={query.data} isEmpty={query.data?.data.groups.length === 0} provisionalRows>
    {query.data && <OeeGroupTable report={query.data.data} groupTitle={group === 'unit' ? 'Unit' : 'Product'} labelOf={labelOf} testId={`oee-by-${group}`} />}
  </AnalyticsCard>;
}
