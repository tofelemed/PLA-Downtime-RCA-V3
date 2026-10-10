import { useRcaOutcome } from '@/api/v2/queries/rca-cases';
import { currencyDigits } from '@/features/display-currency/money-format';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Quantity } from '@/features/ux-kit/quantity';
import { ApprovedImpact } from './components/approved-impact';

/**
 * RCA03 outcome: approved historical loss (ledger), claimed avoided loss (owners) and realized difference
 * (verification vs baseline) side by side — three figures with different bases, never added up.
 */
export function OutcomePanel({ rcaId }: { rcaId: string }) {
  const outcome = useRcaOutcome(rcaId);
  const data = outcome.data;
  return (
    <DataState state={dataStateOf(outcome)} error={outcome.error}>
      {data && (
        <div className="grid gap-3 md:grid-cols-3" data-testid="outcome-panel">
          <section className="rounded border p-2">
            <h3 className="text-sm font-medium">Approved historical loss</h3>
            <ApprovedImpact impact={data.approvedHistoricalLoss} />
          </section>
          <section className="rounded border p-2" data-testid="outcome-claimed">
            <h3 className="text-sm font-medium">Claimed avoided loss</h3>
            {data.claimedAvoided.length === 0 ? (
              <p className="text-sm text-muted-foreground">No claims.</p>
            ) : (
              <ul className="text-sm">
                {data.claimedAvoided.map((claim) => (
                  <li key={claim.currency}>
                    <Quantity value={claim.amount} uom={claim.currency} fractionDigits={currencyDigits(claim.currency)} /> ({claim.actions} action(s))
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded border p-2" data-testid="outcome-realized">
            <h3 className="text-sm font-medium">Realized difference</h3>
            {data.realized.length === 0 ? (
              <p className="text-sm text-muted-foreground">No verified action yet.</p>
            ) : (
              <ul className="text-sm">
                {data.realized.map((row) => (
                  <li key={row.actionId}>
                    {row.title}: {row.difference} {row.metric.replace('_', ' ')} (expected {row.expected}, observed {row.observed})
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
