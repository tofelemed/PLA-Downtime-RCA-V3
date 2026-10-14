import { Badge } from '@/components/ui/badge';
import { useWaterfall } from '@/api/v2/queries/period-overview';
import type { LedgerKind, RevisionSelector } from '@/api/v2/types/period-overview';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { humanize } from '@/features/ux-kit/labels';
import { Quantity } from '@/features/ux-kit/quantity';
import { WaterfallChart } from './waterfall-chart';

export interface WaterfallPanelProps {
  periodId: string;
  ledger: LedgerKind;
  view: RevisionSelector;
}

/**
 * Ledger waterfall (plan 3.5 step 4, rebinds PlanWaterfallChart): the server's bars from plan target (or
 * capacity) through every loss kind, tolerance adjustment and residual / overproduction to actual, each
 * with start and end; the unit comes from the API and "closes to actual" is the server's check.
 */
export function WaterfallPanel({ periodId, ledger, view }: WaterfallPanelProps) {
  const waterfall = useWaterfall([periodId], ledger, view);
  const data = waterfall.data;
  const state = dataStateOf(waterfall, { isEmpty: data !== undefined && data.bars.length === 0 });
  return (
    <section className="space-y-2" data-testid="waterfall" data-ledger={ledger} data-closes={data?.closes ? 'true' : 'false'}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium">Waterfall · {ledger === 'plan' ? 'plan ledger' : 'capacity ledger'}</h3>
        {data && <Badge variant={data.closes ? 'default' : 'destructive'}>{data.closes ? 'Closes to actual' : 'Does not close — check the excluded slices'}</Badge>}
        {data && <Badge variant="outline">Unit: {data.uom ?? 'unknown'}</Badge>}
      </div>
      <DataState state={state} error={waterfall.error} detail={state === 'empty' ? 'No computable slice for this ledger (see the status above).' : undefined}>
        {data && (
          <>
            <WaterfallChart bars={data.bars} uom={data.uom} />
            <table className="w-full text-sm" aria-label="Waterfall bars">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="font-normal">Bar</th>
                  <th className="font-normal">Change</th>
                  <th className="font-normal">Running total</th>
                </tr>
              </thead>
              <tbody>
                {data.bars.map((bar) => (
                  <tr key={bar.key} className="border-t" data-testid="waterfall-bar" data-key={bar.key} data-delta={bar.delta ?? ''} data-end={bar.end}>
                    <td>{bar.label}</td>
                    <td>{bar.delta === null ? '—' : <Quantity value={bar.delta} uom={data.uom} />}</td>
                    <td>
                      <Quantity value={bar.end} uom={data.uom} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.plannedTransition !== null && (
              <p className="text-xs text-muted-foreground" data-testid="waterfall-planned-transition">
                Planned grade transition (within standard, already in the plan target): <Quantity value={data.plannedTransition} uom={data.uom} /> — not a loss
              </p>
            )}
            {data.excluded.length > 0 && <p className="text-xs text-muted-foreground">Excluded: {data.excluded.map((e) => humanize(e.reason)).join(', ')}</p>}
          </>
        )}
      </DataState>
    </section>
  );
}
