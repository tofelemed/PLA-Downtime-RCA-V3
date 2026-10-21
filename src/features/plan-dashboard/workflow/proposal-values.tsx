import type { ChangeProposalView } from '@/api/v2/types/reconciliation';
import { entriesInCurrency, formatCurrencyAmount } from '@/features/display-currency/money-format';
import { useDisplayCurrency } from '@/features/display-currency/use-display-currency';
import { DEFAULT_BASIS_LABELS, labelOf, REVISION_LIFECYCLE_LABELS } from '@/features/ux-kit/labels';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { proposalValuesOf, type ProposalAmount, type ProposalValues as Values } from '../model/proposal-labels';

function AmountText({ amount }: { amount: ProposalAmount }) {
  const { digits } = useNumberFormat();
  if (amount.amount === null) return <>— {amount.currency} (not fully valued)</>;
  return <>{formatCurrencyAmount(amount.amount, amount.currency, digits)}</>;
}

/** The amounts in the display currency (USD / IRR switch; all of them when none is in it; never converted). */
function Amounts({ values }: { values: Values }) {
  const { currency } = useDisplayCurrency();
  const shown = entriesInCurrency(values.amounts, (a) => a.currency, currency);
  return (
    <>
      {shown.map((a, i) => (
        <span key={a.currency}>
          {i > 0 && ' · '}
          <AmountText amount={a} />
        </span>
      ))}
    </>
  );
}

/** The value after: the accepted revision's once it exists, else why it is not known (yet). */
function AfterValue({ p }: { p: ChangeProposalView }) {
  const preview = proposalValuesOf(p.after);
  if (preview) return <Amounts values={preview} />;
  const after = p.valueAfter;
  if (after?.values) return <Amounts values={after.values} />;
  if (after) return <>Not valued yet (revision {after.revision})</>;
  if (p.state === 'dismissed') return <>Dismissed: the approved value stays.</>;
  return <>Calculated when the proposal is accepted: the new draft revision is revalued with the inputs in force.</>;
}

function afterLabel(p: ChangeProposalView): string {
  const after = p.valueAfter;
  if (!after) return 'Loss value after';
  const view = after.values ? `, ${labelOf(DEFAULT_BASIS_LABELS, after.values.view)}` : '';
  return `Loss value after (revision ${after.revision}, ${labelOf(REVISION_LIFECYCLE_LABELS, after.lifecycle).toLowerCase()}${view})`;
}

/**
 * The loss value of a change proposal (Marun E2E, QA audit P-1): the approved value in the policy's
 * default view, one figure per reporting currency, as the server stored it; the value after is the
 * accepted revision's, shown once the server has it. Nothing is converted or added up here.
 */
export function ProposalValues({ p }: { p: ChangeProposalView }) {
  const before = proposalValuesOf(p.before);
  if (!before && !p.valueAfter?.values && !proposalValuesOf(p.after)) return null;
  return (
    <dl className="grid gap-1 text-xs sm:grid-cols-2" data-testid="proposal-values">
      {before && (
        <div>
          <dt className="text-muted-foreground">Loss value before (approved, {labelOf(DEFAULT_BASIS_LABELS, before.view)})</dt>
          <dd>
            <Amounts values={before} />
          </dd>
        </div>
      )}
      <div>
        <dt className="text-muted-foreground">{afterLabel(p)}</dt>
        <dd data-testid="proposal-value-after">
          <AfterValue p={p} />
        </dd>
      </div>
    </dl>
  );
}
