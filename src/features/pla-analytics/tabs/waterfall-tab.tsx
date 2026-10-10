import { lazy, Suspense } from 'react';
import { useScopeWaterfall } from '@/api/v2/queries/pla-analytics';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Quantity } from '@/features/ux-kit/quantity';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { ReportCard } from '@/features/downtime-analysis/components/report-card';
import { waterfallQuery, type AnalyticsScope } from '../model/analytics-scope';

const WaterfallChart = lazy(() => import('@/features/plan-dashboard/components/waterfall-chart').then((m) => ({ default: m.WaterfallChart })));

/**
 * Plan or capacity waterfall of the whole scope (AN02): the server's bars from plan target (or capacity)
 * through every loss kind, tolerance, residual / overproduction to actual, each with start and end;
 * "closes to actual" is the server's exact check, excluded slices are listed with their reason.
 */
export function WaterfallTab({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const query = useScopeWaterfall(waterfallQuery(scope), env.timezone);
  const data = query.data?.data;
  return (
    <ReportCard
      title={`Waterfall · ${scope.ledger === 'plan' ? 'plan ledger (target → actual)' : 'capacity ledger (capacity → good)'}`}
      testId="pla-waterfall"
      query={query}
      response={query.data}
      isEmpty={data !== undefined && data.bars.length === 0}
      emptyText="No computable period in this scope for this ledger."
      actions={data && <Badge variant={data.closes ? 'default' : 'destructive'} data-testid="waterfall-closes" data-closes={String(data.closes)}>{data.closes ? 'Closes to actual' : 'Does not close'}</Badge>}
    >
      {data && (
        <div data-testid="waterfall" data-ledger={data.ledger} data-closes={String(data.closes)} data-opening={data.opening ?? ''} data-closing={data.closing ?? ''}>
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <WaterfallChart bars={data.bars} uom={data.uom} />
          </Suspense>
          <Table aria-label="Waterfall bars">
            <TableHeader>
              <TableRow>
                <TableHead>Bar</TableHead>
                <TableHead className="text-right">Change</TableHead>
                <TableHead className="text-right">Running total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.bars.map((bar) => (
                <TableRow key={bar.key} data-testid="waterfall-bar" data-key={bar.key} data-delta={bar.delta ?? ''} data-end={bar.end}>
                  <TableCell>{bar.label}</TableCell>
                  <TableCell className="text-right">{bar.delta === null ? '—' : <Quantity value={bar.delta} uom={data.uom} />}</TableCell>
                  <TableCell className="text-right">
                    <Quantity value={bar.end} uom={data.uom} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {data.excluded.length > 0 && (
            <p className="text-xs text-muted-foreground" data-testid="waterfall-excluded">
              {data.excluded.length} slices left out (figure unknown): {[...new Set(data.excluded.map((e) => e.reason.replace(/_/g, ' ')))].join(', ')}
            </p>
          )}
        </div>
      )}
    </ReportCard>
  );
}
