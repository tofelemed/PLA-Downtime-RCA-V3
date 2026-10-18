import { lazy, Suspense, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProducts } from '@/api/v2/queries/profiles';
import { useOeeReport } from '@/api/v2/queries/reports';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import type { TrendGroup } from '@/api/v2/types/pla-analytics';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AnalysisModeSelect } from '@/features/analysis-navigation/analysis-mode-select';
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

const SeriesChart = lazy(() => import('../charts/series-chart').then((module) => ({ default: module.SeriesChart })));
const MODES = [{ value: 'oee', label: 'OEE over time' }, { value: 'residual', label: 'Reconciliation residuals' }, { value: 'units', label: 'OEE by unit' }, { value: 'products', label: 'OEE by product' }];
export interface TrendsTabProps { scope: AnalyticsScope; onChange: (patch: Partial<AnalyticsScope>) => void; }

export function TrendsTab({ scope, onChange }: TrendsTabProps) {
  const [params] = useSearchParams();
  const mode = params.get('series');
  return (
    <div className="space-y-4">
      <AnalysisModeSelect param="series" label="Show" options={MODES} />
      <TrendControls scope={scope} onChange={onChange} grouping={mode !== 'units' && mode !== 'products'} policy={mode !== 'residual'} />
      {mode === 'residual' ? <ResidualTrendCard scope={scope} /> : mode === 'units' ? <UnitComparison scope={scope} />
        : mode === 'products' ? <ProductComparison scope={scope} /> : <OeeTrend scope={scope} />}
    </div>
  );
}

function TrendControls({ scope, onChange, grouping, policy }: TrendsTabProps & { grouping: boolean; policy: boolean }) {
  return <div className="flex flex-wrap items-center gap-2">
    {grouping && <><Label htmlFor="trend-by">Trend by</Label><select id="trend-by" data-testid="trend-by" className={SELECT_CLASS} value={scope.trendBy} onChange={(event) => onChange({ trendBy: event.target.value as TrendGroup })}>
      {TREND_GROUPS.map((group) => <option key={group} value={group}>{TREND_LABELS[group]}</option>)}
    </select></>}
    {policy && <><Label htmlFor="trend-policy">OEE</Label><select id="trend-policy" data-testid="trend-policy" className={SELECT_CLASS} value={scope.policy} onChange={(event) => onChange({ policy: event.target.value as OeePolicy })}>
      <option value="operational">Operational OEE (ISO 22400)</option><option value="reconciled">Reconciled PLA OEE (labelled)</option>
    </select></>}
  </div>;
}

function OeeTrend({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const trend = useOeeReport(oeeQuery(scope, scope.trendBy), env.timezone);
  const report = trend.data?.data;
  const pref = useCalendarPreference();
  const label = (key: string | null) => bucketLabel(key, scope.trendBy, pref);
  return <AnalyticsCard title={`${report?.label ?? 'OEE'} by ${TREND_LABELS[scope.trendBy].toLowerCase()}`} testId="pla-oee-trend" query={trend} response={trend.data} isEmpty={report?.groups.length === 0} note="Buckets use the plant's operational date and shift; each value is the sum of numerators over the sum of denominators.">
    {report && <div data-testid="oee-trend" data-group-by={report.groupBy} data-policy={report.policy}>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}><SeriesChart rows={oeeRows(report, label)} series={report.total.map((entry) => ({ key: entry.metric, label: OEE_METRIC_LABELS[entry.metric.replace('reconciled_', '')] ?? entry.metric }))} kind="line" ratio /></Suspense>
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
  return <AnalyticsCard title={`${query.data?.data.label ?? 'OEE'} by ${group}`} testId={`pla-oee-${group}s`} query={query} response={query.data} isEmpty={query.data?.data.groups.length === 0}>
    {query.data && <OeeGroupTable report={query.data.data} groupTitle={group === 'unit' ? 'Unit' : 'Product'} labelOf={labelOf} testId={`oee-by-${group}`} />}
  </AnalyticsCard>;
}
