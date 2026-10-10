import { lazy, Suspense } from 'react';
import { useReconciliationTrend } from '@/api/v2/queries/pla-analytics';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Quantity } from '@/features/ux-kit/quantity';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { ReportCard } from '@/features/downtime-analysis/components/report-card';
import { trendQuery, type AnalyticsScope } from '../model/analytics-scope';
import { TREND_LABELS } from '../model/display';
import { residualRows, trendUnits } from '../model/series';

const SeriesChart = lazy(() => import('../charts/series-chart').then((m) => ({ default: m.SeriesChart })));

const SERIES = [
  { key: 'unaccounted', label: 'Unaccounted' },
  { key: 'overAccounted', label: 'Over-accounted' },
  { key: 'overproduction', label: 'Overproduction' },
];

/**
 * Unaccounted and over-accounted trend (AN02): the plan-ledger residual steps of the waterfall per bucket
 * and unit of measure (server `groupBy`), so the buckets add up to the waterfall bars.
 */
export function ResidualTrendCard({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const query = useReconciliationTrend(trendQuery(scope), env.timezone);
  const data = query.data?.data;
  const units = trendUnits(data);
  return (
    <ReportCard
      title={`Unaccounted / over-accounted by ${TREND_LABELS[scope.trendBy].toLowerCase()} (plan ledger)`}
      testId="pla-residual-trend"
      query={query}
      response={query.data}
      isEmpty={data?.buckets.length === 0}
      note="After the saved decisions of each period; buckets without a computable slice show —."
    >
      {data && (
        <div data-testid="residual-trend" data-group-by={data.groupBy}>
          {units.map((uom) => (
            <div key={uom ?? '-'} className="space-y-2">
              <Suspense fallback={<Skeleton className="h-64 w-full" />}>
                <SeriesChart rows={residualRows(data, uom)} series={SERIES} kind="bar" />
              </Suspense>
              <Table aria-label={`Residual trend in ${uom ?? 'unknown unit'}`}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bucket</TableHead>
                    {SERIES.map((s) => (
                      <TableHead key={s.key} className="text-right">
                        {s.label}
                      </TableHead>
                    ))}
                    <TableHead className="text-right">Periods</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.buckets
                    .filter((b) => b.uom === uom)
                    .map((b) => (
                      <TableRow key={b.key} data-testid="residual-bucket" data-key={b.key} data-unaccounted={b.unaccounted ?? ''}>
                        <TableCell>{b.key}</TableCell>
                        <TableCell className="text-right"><Quantity value={b.unaccounted} uom={b.uom} /></TableCell>
                        <TableCell className="text-right"><Quantity value={b.overAccounted} uom={b.uom} /></TableCell>
                        <TableCell className="text-right"><Quantity value={b.overproduction} uom={b.uom} /></TableCell>
                        <TableCell className="text-right">{b.periods}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </div>
      )}
    </ReportCard>
  );
}
