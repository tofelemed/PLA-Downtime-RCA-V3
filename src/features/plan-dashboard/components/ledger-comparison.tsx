import type { AnalyticsResponse } from '@/api/v2/types/envelopes';
import type { LedgerKind, LedgerTotalsView, PeriodAccountingView } from '@/api/v2/types/period-overview';
import { labelOf } from '@/features/ux-kit/labels';
import { Quantity } from '@/features/ux-kit/quantity';
import { isDataFlag } from '../model/candidate-derivation';
import { FLAG_LABELS } from '../model/display';
import { DECLARED_NOT_AVAILABLE } from '@/features/pla-analytics/model/declared-access';

export interface LedgerComparisonProps {
  accounting: AnalyticsResponse<PeriodAccountingView> | null;
  ledger: LedgerKind;
  /** declared mode: no capacity ledger is computed */
  declared?: boolean;
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
  ['residual', 'Unaccounted'],
  ['good', 'Good (actual)'],
  ['overproduction', 'Overproduction'],
  ['overAccounted', 'Over-accounted'],
];

/** Flags as words; value-carrying flags (`stops_cross_check:<qty>:<uom>`) are data, shown elsewhere. */
function statusOf(flags: readonly string[] | undefined): string {
  return flags?.filter((f) => !isDataFlag(f)).map((f) => labelOf(FLAG_LABELS, f)).join(', ') || '—';
}

/**
 * Both ledgers of the run side by side per slice (D04: both always computed, the plan ledger is the
 * default view); figures as stored by the calculation run — the reconciliation decisions change the plan
 * ledger figures above, never these run totals.
 */
export function LedgerComparison({ accounting, ledger, declared = false }: LedgerComparisonProps) {
  const totals = accounting?.data.totals ?? [];
  const slices = [...new Set(totals.map((t) => t.sliceId))];
  if (!slices.length) return null;
  return (
    <details className="space-y-2" data-testid="ledger-comparison">
      <summary className="cursor-pointer text-sm font-medium">Raw calculation (before loss-line decisions)</summary>
      <p className="text-xs text-muted-foreground">Run ledgers (plan vs capacity) as calculated, before loss-line decisions. The reconciliation figures above include saved decisions and manual lines.</p>
      {slices.map((sliceId) => {
        const plan = totals.find((t) => t.sliceId === sliceId && t.ledger === 'plan');
        const capacity = totals.find((t) => t.sliceId === sliceId && t.ledger === 'capacity');
        return (
          <div key={sliceId} className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Ledger totals">
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
                    {!declared && <td>{capacity ? <Quantity value={capacity[key] as string | null} uom={capacity.uom} /> : '—'}</td>}
                    {declared && key === ROWS[0][0] && <td rowSpan={ROWS.length + 1} className="align-top text-xs text-muted-foreground" data-testid="capacity-not-available">{DECLARED_NOT_AVAILABLE}</td>}
                  </tr>
                ))}
                <tr className="border-t text-xs text-muted-foreground">
                  <td>Status</td>
                  <td>{statusOf(plan?.flags)}</td>
                  {!declared && <td>{statusOf(capacity?.flags)}</td>}
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}
    </details>
  );
}
