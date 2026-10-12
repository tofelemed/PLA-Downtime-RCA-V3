import { lazy, Suspense } from 'react';
import { useScopeWaterfall } from '@/api/v2/queries/pla-analytics';
import type { ScopeWaterfallView } from '@/api/v2/types/pla-analytics';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { humanize } from '@/features/ux-kit/labels';
import { Quantity } from '@/features/ux-kit/quantity';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { AnalyticsCard } from '../components/analytics-card';
import { waterfallQuery, type AnalyticsScope } from '../model/analytics-scope';

const WaterfallChart = lazy(() => import('@/features/plan-dashboard/components/waterfall-chart').then((m) => ({ default: m.WaterfallChart })));

type Bar = ScopeWaterfallView['bars'][number];

function columnsOf(uom: string | null): Array<DataTableColumn<Bar>> {
  return [
    {
      id: 'bar',
      header: 'Bar',
      cell: (bar) => (
        <span data-testid="waterfall-bar" data-key={bar.key} data-delta={bar.delta ?? ''} data-end={bar.end}>
          {bar.label}
        </span>
      ),
    },
    { id: 'delta', header: 'Change', align: 'right', nowrap: true, cell: (bar) => (bar.delta === null ? '—' : <Quantity value={bar.delta} uom={uom} />) },
    { id: 'end', header: 'Running total', align: 'right', nowrap: true, cell: (bar) => <Quantity value={bar.end} uom={uom} /> },
  ];
}

/**
 * Plan or capacity waterfall of the whole scope (AN02): the server's bars from plan target (or capacity)
 * through every loss kind, tolerance, residual / overproduction to actual, each with start and end;
 * "closes to actual" is the server's exact check, excluded slices are counted with their reasons.
 */
export function WaterfallTab({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const query = useScopeWaterfall(waterfallQuery(scope), env.timezone);
  const data = query.data?.data;
  const closes = data && (
    <Badge variant={data.closes ? 'default' : 'destructive'} data-testid="waterfall-closes" data-closes={String(data.closes)}>
      {data.closes ? 'Closes to actual' : 'Does not close'}
    </Badge>
  );
  return (
    <AnalyticsCard
      title={`Waterfall · ${scope.ledger === 'plan' ? 'plan ledger (target → actual)' : 'capacity ledger (capacity → good)'}`}
      testId="pla-waterfall"
      query={query}
      response={query.data}
      isEmpty={data !== undefined && data.bars.length === 0}
      emptyText="No computable period in this scope for this ledger."
      actions={closes}
    >
      {data && (
        <div className="space-y-3" data-testid="waterfall" data-ledger={data.ledger} data-closes={String(data.closes)} data-opening={data.opening ?? ''} data-closing={data.closing ?? ''}>
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <WaterfallChart bars={data.bars} uom={data.uom} />
          </Suspense>
          <DataTable caption="Waterfall bars" columns={columnsOf(data.uom)} rows={data.bars} getRowKey={(bar) => bar.key} pager="none" density="compact" />
          {data.excluded.length > 0 && (
            <p className="text-xs text-muted-foreground" data-testid="waterfall-excluded">
              {data.excluded.length} slices left out (figure unknown): {[...new Set(data.excluded.map((e) => humanize(e.reason)))].join(', ')}
            </p>
          )}
        </div>
      )}
    </AnalyticsCard>
  );
}
