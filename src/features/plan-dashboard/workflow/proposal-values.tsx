import type { ChangeProposalView } from '@/api/v2/types/reconciliation';
import { formatCurrencyAmount } from '@/features/display-currency/money-format';
import { DEFAULT_BASIS_LABELS, labelOf } from '@/features/ux-kit/labels';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { proposalValuesOf, type ProposalAmount } from '../model/proposal-labels';

function AmountText({ amount }: { amount: ProposalAmount }) {
  const { digits } = useNumberFormat();
  if (amount.amount === null) return <>— {amount.currency} (not fully valued)</>;
  return <>{formatCurrencyAmount(amount.amount, amount.currency, digits)}</>;
}

/**
 * The loss value of a change proposal (Marun E2E): the approved value in the policy's default view, one
 * figure per reporting currency, as the server stored it; the new value is calculated when the proposal is
 * accepted and the new draft revision is revalued. Nothing is converted or added up here.
 */
export function ProposalValues({ p }: { p: ChangeProposalView }) {
  const before = proposalValuesOf(p.before);
  const after = proposalValuesOf(p.after);
  if (!before && !after) return null;
  return (
    <dl className="grid gap-1 text-xs sm:grid-cols-2" data-testid="proposal-values">
      {before && (
        <div>
          <dt className="text-muted-foreground">Loss value before (approved, {labelOf(DEFAULT_BASIS_LABELS, before.view)})</dt>
          <dd>
            {before.amounts.map((a, i) => (
              <span key={a.currency}>
                {i > 0 && ' · '}
                <AmountText amount={a} />
              </span>
            ))}
          </dd>
        </div>
      )}
      <div>
        <dt className="text-muted-foreground">Loss value after</dt>
        <dd>
          {after
            ? after.amounts.map((a, i) => (
                <span key={a.currency}>
                  {i > 0 && ' · '}
                  <AmountText amount={a} />
                </span>
              ))
            : 'Calculated when the proposal is accepted: the new draft revision is revalued with the inputs in force.'}
        </dd>
      </div>
    </dl>
  );
}
