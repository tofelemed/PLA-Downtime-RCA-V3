import { lazy, Suspense } from 'react';
import { Link, type To } from 'react-router-dom';
import { useScopeWaterfall } from '@/api/v2/queries/pla-analytics';
import type { ScopeWaterfallView } from '@/api/v2/types/pla-analytics';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { humanize } from '@/features/ux-kit/labels';
import { Quantity } from '@/features/ux-kit/quantity';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { StatusIcon } from '@/lib/icons';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { AnalyticsCard } from '../components/analytics-card';
import { KpiTile, type KpiTileSpec } from '../dashboard/kpi-tile';
import { waterfallQuery, type AnalyticsScope } from '../model/analytics-scope';
import { waterfallBarLink } from '../model/links';
import { waterfallBarLabel } from '@/features/plan-dashboard/model/display';

const WaterfallChart = lazy(() => import('@/features/plan-dashboard/components/waterfall-chart').then((m) => ({ default: m.WaterfallChart })));

type Bar = ScopeWaterfallView['bars'][number];

function BarLabel({ bar, to }: { bar: Bar; to: To | null }) {
  const testProps = { 'data-testid': 'waterfall-bar', 'data-key': bar.key, 'data-delta': bar.delta ?? '', 'data-end': bar.end };
  return to ? <Link to={to} className="text-primary underline underline-offset-4" {...testProps}>{waterfallBarLabel(bar)}</Link> : <span {...testProps}>{waterfallBarLabel(bar)}</span>;
}

/** The bars that lead somewhere (loss events of an OEE component, reconciliation), as keyboard-reachable links. */
function BarDrills({ bars, linkOf }: { bars: readonly Bar[]; linkOf: (bar: Bar) => To | null }) {
  const linked = bars.flatMap((bar) => {
    const to = linkOf(bar);
    return to ? [{ bar, to }] : [];
  });
  if (linked.length === 0) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" data-testid="waterfall-drills">
      <span className="text-muted-foreground">Show what is behind a bar:</span>
      {linked.map(({ bar, to }) => (
        <Link key={bar.key} to={to} className="text-primary underline underline-offset-4" data-testid="waterfall-drill" data-key={bar.key}>
          {waterfallBarLabel(bar)}
        </Link>
      ))}
    </p>
  );
}

function columnsOf(uom: string | null, linkOf: (bar: Bar) => To | null): Array<DataTableColumn<Bar>> {
  return [
    { id: 'bar', header: 'Bar', cell: (bar) => <BarLabel bar={bar} to={linkOf(bar)} /> },
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
  const { number } = useNumberFormat();
  const linkOf = (bar: Bar) => waterfallBarLink(scope, bar.key);
  return (
    <AnalyticsCard
      title={`Waterfall · ${scope.ledger === 'plan' ? 'target → actual' : 'capacity → good'}`}
      testId="pla-waterfall"
      query={query}
      response={query.data}
      isEmpty={data !== undefined && data.bars.length === 0}
      emptyText="No computable period in this scope for this ledger."
      actions={<WaterfallState data={data} />}
    >
      {data && (
        <div className="space-y-3" data-testid="waterfall" data-ledger={data.ledger} data-closes={String(data.closes)} data-opening={data.opening ?? ''} data-closing={data.closing ?? ''}>
          <WaterfallTotals data={data} plan={scope.ledger === 'plan'} />
          {data.excluded.length > 0 && (
            <Alert className="border-warning/40 bg-warning/10 text-warning [&>svg]:text-warning" data-testid="waterfall-excluded">
              <StatusIcon.warning aria-hidden="true" className="h-4 w-4" />
              <AlertTitle>Totals are incomplete</AlertTitle>
              <AlertDescription>
                {number(data.excluded.length)} {data.excluded.length === 1 ? 'slice is' : 'slices are'} left out because the figure is unknown: {[...new Set(data.excluded.map((e) => humanize(e.reason)))].join(', ')}.
              </AlertDescription>
            </Alert>
          )}
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <WaterfallChart bars={data.bars} uom={data.uom} barLink={linkOf} />
          </Suspense>
          <BarDrills bars={data.bars} linkOf={linkOf} />
          <details><summary className="cursor-pointer text-sm text-primary">View waterfall values</summary>
            <DataTable caption="Waterfall bars" columns={columnsOf(data.uom, linkOf)} rows={data.bars} getRowKey={(bar) => bar.key} pager="none" density="compact" />
          </details>
        </div>
      )}
    </AnalyticsCard>
  );
}

const OPENING: Readonly<Record<'plan' | 'capacity', KpiTileSpec>> = {
  plan: { title: 'Plan target', info: 'Planned production from the approved plan for the selected periods. The waterfall starts here and steps down through each loss to actual good output.' },
  capacity: { title: 'Sustained capacity', info: 'What the unit can make at its approved sustained rate over the full time of the selected periods, before planned downtime is taken off. The waterfall starts here.' },
};
const CLOSING: KpiTileSpec = { title: 'Actual good output', info: 'On-spec product made in the selected periods. Off-grade output is a quality loss, not counted here. The waterfall ends here.' };

/** Where the waterfall starts and ends, as the dashboard's KPI tiles (uppercase label, ⓘ definition). */
function WaterfallTotals({ data, plan }: { data: ScopeWaterfallView; plan: boolean }) {
  return <div className="grid grid-cols-2 gap-3">
    <KpiTile spec={OPENING[plan ? 'plan' : 'capacity']} value={<Quantity value={data.opening} uom={data.uom} />} testId="waterfall-total-opening" />
    <KpiTile spec={CLOSING} value={<Quantity value={data.closing} uom={data.uom} />} testId="waterfall-total-closing" />
  </div>;
}

function WaterfallState({ data }: { data: ScopeWaterfallView | undefined }) {
  if (!data) return null;
  return <Badge variant={data.closes ? 'default' : 'destructive'} data-testid="waterfall-closes" data-closes={String(data.closes)}>{data.closes ? 'Closes to actual' : 'Does not close'}</Badge>;
}
