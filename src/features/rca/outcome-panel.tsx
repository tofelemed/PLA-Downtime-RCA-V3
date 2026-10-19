import { useCapabilities } from '@/features/auth/use-capabilities';
import { useRcaOutcome } from '@/api/v2/queries/rca-cases';
import { currencyDigits } from '@/features/display-currency/money-format';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Quantity } from '@/features/ux-kit/quantity';
import { labelOf } from '@/features/ux-kit/labels';
import { RCA_BASELINE_METRIC_LABELS, RCA_VERDICT_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { ApprovedImpact } from './components/approved-impact';
import { plural } from '@/features/ux-kit/format/plural';

/**
 * RCA03 outcome: approved historical loss (ledger), claimed avoided loss (owners) and realized difference
 * (verification vs baseline) side by side — three figures with different bases, never added up.
 */
export function OutcomePanel({ rcaId }: { rcaId: string }) {
  const outcome = useRcaOutcome(rcaId);
  const { decimal } = useNumberFormat();
  const data = outcome.data;
  // QA re-test N1: claimed avoided loss is money, not shown (nor sent by the server) without the capability
  const { canViewMoney } = useCapabilities();
  return (
    <DataState state={dataStateOf(outcome)} error={outcome.error}>
      {data && (
        <div className="grid gap-3 md:grid-cols-3" data-testid="outcome-panel">
          <section className="rounded border p-2">
            <h3 className="text-sm font-medium">Approved historical loss</h3>
            <ApprovedImpact impact={data.approvedHistoricalLoss} />
          </section>
          {canViewMoney && <section className="rounded border p-2" data-testid="outcome-claimed">
            <h3 className="text-sm font-medium">Claimed avoided loss</h3>
            {(data.claimedAvoided ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No claims.</p>
            ) : (
              <ul className="text-sm">
                {(data.claimedAvoided ?? []).map((claim) => (
                  <li key={claim.currency}>
                    <Quantity value={claim.amount} uom={claim.currency} fractionDigits={currencyDigits(claim.currency)} /> ({plural(claim.actions, 'action', 'actions')})
                  </li>
                ))}
              </ul>
            )}
          </section>}
          <section className="rounded border p-2" data-testid="outcome-realized">
            <h3 className="text-sm font-medium">Realized difference</h3>
            {data.realized.length === 0 ? (
              <p className="text-sm text-muted-foreground">No verified action yet.</p>
            ) : (
              <ul className="text-sm">
                {data.realized.map((row) => (
                  <li key={row.actionId}>
                    {row.title}: {decimal(row.difference, 2)} {labelOf(RCA_BASELINE_METRIC_LABELS, row.metric).toLowerCase()} (expected {decimal(row.expected, 2)}, observed {decimal(row.observed, 2)})
                    {row.verdict ? ` · ${labelOf(RCA_VERDICT_LABELS, row.verdict)}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <p className="text-xs text-muted-foreground md:col-span-3">{data.note}</p>
        </div>
      )}
    </DataState>
  );
}
