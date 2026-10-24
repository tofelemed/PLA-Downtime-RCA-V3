import { lazy, Suspense } from 'react';
import type { ReconciliationTrendBucketView } from '@/api/v2/types/pla-analytics';
import { Skeleton } from '@/components/ui/skeleton';
import { useCalendarPreference } from '@/lib/dates';
import { bucketLabel } from '../model/buckets';
import type { AnalyticsScope } from '../model/analytics-scope';

const PlanTrendBars = lazy(() => import('../charts/plan-trend-bars').then((m) => ({ default: m.PlanTrendBars })));

/** Actual, explained and unexplained loss per step of the period, in one unit of measure (buckets are the server's, in order). */
export function PlanTrendChart({ scope, buckets, uom }: { scope: AnalyticsScope; buckets: readonly ReconciliationTrendBucketView[]; uom: string }) {
  const pref = useCalendarPreference();
  const rows = buckets
    .filter((bucket) => bucket.uom === uom)
    .map((bucket) => ({ label: bucketLabel(bucket.key, scope.trendBy, pref), actual: bucket.actual, explained: bucket.explained, unexplained: bucket.unexplained }));
  return (
    <div className="space-y-2" data-testid="plan-trend">
      <h3 className="text-sm font-medium">Plan trend</h3>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <PlanTrendBars rows={rows} uom={uom} />
      </Suspense>
    </div>
  );
}
