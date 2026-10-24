import type { ReactNode } from 'react';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useRcaOutcome } from '@/api/v2/queries/rca-cases';
import type { RcaOutcomeView } from '@/api/v2/types/rca';
import { currencyDigits } from '@/features/display-currency/money-format';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Quantity } from '@/features/ux-kit/quantity';
import { labelOf } from '@/features/ux-kit/labels';
import { RCA_BASELINE_METRIC_LABELS, RCA_VERDICT_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { plural } from '@/features/ux-kit/format/plural';
import { CaseCard } from './case/components/case-card';
import { ApprovedImpact } from './components/approved-impact';

const OUTCOME_INFO = 'Approved historical loss, claimed avoided loss and realized difference — three separate figures, never added up.';

function Figure({ title, testId, children }: { title: string; testId?: string; children: ReactNode }) {
  return (
    <section className="flex h-full flex-col gap-1.5 rounded-md border p-3" data-testid={testId}>
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
  );
}

function Claimed({ data }: { data: RcaOutcomeView }) {
  const claims = data.claimedAvoided ?? [];
  if (claims.length === 0) return <p className="text-sm text-muted-foreground">No claims.</p>;
  return (
    <ul className="text-sm">
      {claims.map((claim) => (
        <li key={claim.currency}>
          <Quantity value={claim.amount} uom={claim.currency} fractionDigits={currencyDigits(claim.currency)} /> ({plural(claim.actions, 'action', 'actions')})
        </li>
      ))}
    </ul>
  );
}

function Realized({ data }: { data: RcaOutcomeView }) {
  const { decimal } = useNumberFormat();
  if (data.realized.length === 0) return <p className="text-sm text-muted-foreground">No verified action yet.</p>;
  return (
    <ul className="space-y-1 text-sm">
      {data.realized.map((row) => (
        <li key={row.actionId}>
          {row.title}: {decimal(row.difference, 2)} {labelOf(RCA_BASELINE_METRIC_LABELS, row.metric).toLowerCase()} (expected {decimal(row.expected, 2)}, observed {decimal(row.observed, 2)})
          {row.verdict ? ` · ${labelOf(RCA_VERDICT_LABELS, row.verdict)}` : ''}
        </li>
      ))}
    </ul>
  );
}

/**
 * RCA03 outcome card: approved historical loss (ledger), claimed avoided loss (owners) and realized difference
 * (verification vs baseline) side by side — three figures with different bases, never added up (the server's
 * note on the bases is behind the ⓘ).
 */
export function OutcomePanel({ rcaId }: { rcaId: string }) {
  const outcome = useRcaOutcome(rcaId);
  const data = outcome.data;
  // QA re-test N1: claimed avoided loss is money, not shown (nor sent by the server) without the capability
  const { canViewMoney } = useCapabilities();
  return (
    <CaseCard title="Outcome" info={data?.note ? `${OUTCOME_INFO} ${data.note}` : OUTCOME_INFO}>
      <DataState state={dataStateOf(outcome)} error={outcome.error}>
        {data && (
          <div className="grid auto-rows-fr gap-3 md:grid-cols-3" data-testid="outcome-panel">
            <Figure title="Approved historical loss">
              <ApprovedImpact impact={data.approvedHistoricalLoss} />
            </Figure>
            {canViewMoney && (
              <Figure title="Claimed avoided loss" testId="outcome-claimed">
                <Claimed data={data} />
              </Figure>
            )}
            <Figure title="Realized difference" testId="outcome-realized">
              <Realized data={data} />
            </Figure>
          </div>
        )}
      </DataState>
    </CaseCard>
  );
}
