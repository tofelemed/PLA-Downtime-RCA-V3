import type { AnalyticsResponse } from '@/api/v2/types/envelopes';
import type { LedgerKind, LedgerTotalsView, PeriodAccountingView } from '@/api/v2/types/period-overview';
import { Quantity } from '@/features/ux-kit/quantity';

export interface LedgerComparisonProps {
  accounting: AnalyticsResponse<PeriodAccountingView> | null;
  ledger: LedgerKind;
}

const ROWS: Array<[keyof LedgerTotalsView, string]> = [
  ['target', 'Plan target'],
  ['capacity', 'Capacity (sustained rate)'],
  ['exclusion', 'Schedule exclusion'],
  ['availability', 'Availability'],
  ['performance', 'Performance'],
  ['quality', 'Quality'],
  ['gain', 'Gain'],
  ['attributed', 'Attributed'],
  ['residual', 'Residual'],
  ['good', 'Good (actual)'],
  ['overproduction', 'Overproduction'],
  ['overAccounted', 'Over-accounted'],
];

/**
 * Both ledgers of the run side by side per slice (D04: both always computed, the plan ledger is the
 * default view); figures as stored by the calculation run — the reconciliation decisions change the plan
 * ledger figures above, never these run totals.
 */
export function LedgerComparison({ accounting, ledger }: LedgerComparisonProps) {
  const totals = accounting?.data.totals ?? [];
  const slices = [...new Set(totals.map((t) => t.sliceId))];
  if (!slices.length) return null;
  return (
    <div className="space-y-2" data-testid="ledger-comparison">
      <h3 className="text-sm font-medium">Run ledgers (plan vs capacity)</h3>
      {slices.map((sliceId) => {
        const plan = totals.find((t) => t.sliceId === sliceId && t.ledger === 'plan');
        const capacity = totals.find((t) => t.sliceId === sliceId && t.ledger === 'capacity');
        return (
          <table key={sliceId} className="w-full text-sm" aria-label="Ledger totals">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="font-normal">Figure</th>
                <th className={ledger === 'plan' ? 'font-semibold text-foreground' : 'font-normal'}>Plan ledger</th>
                <th className={ledger === 'capacity' ? 'font-semibold text-foreground' : 'font-normal'}>Capacity ledger</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([key, label]) => (
                <tr key={key} className="border-t">
                  <td>{label}</td>
                  <td>{plan ? <Quantity value={plan[key] as string | null} uom={plan.uom} /> : '—'}</td>
                  <td>{capacity ? <Quantity value={capacity[key] as string | null} uom={capacity.uom} /> : '—'}</td>
                </tr>
              ))}
              <tr className="border-t text-xs text-muted-foreground">
                <td>Flags</td>
                <td>{plan?.flags.join(', ') || '—'}</td>
                <td>{capacity?.flags.join(', ') || '—'}</td>
              </tr>
            </tbody>
          </table>
        );
      })}
    </div>
  );
}
