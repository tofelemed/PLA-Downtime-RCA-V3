import type { RestatementValuesView, ValueDeltaView } from '@/api/v2/types/restatement';
import { entriesInCurrency, formatCurrencyAmount } from '@/features/display-currency/money-format';
import { useDisplayCurrency } from '@/features/display-currency/use-display-currency';
import { DEFAULT_BASIS_LABELS, labelOf } from '@/features/ux-kit/labels';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

function Amount({ value, currency }: { value: string | null; currency: string }) {
  const { digits } = useNumberFormat();
  return <td className="px-2 text-right tabular-nums">{value === null ? `— ${currency} (not valued)` : formatCurrencyAmount(value, currency, digits)}</td>;
}

const viewName = (view: string | null) => (view ? labelOf(DEFAULT_BASIS_LABELS, view) : 'not valued');

/** The figure label: one view, or both when the restatement moved the period to another default view. */
function valueLabel(values: RestatementValuesView): string {
  if (!values.viewChanged) return `Loss value (${viewName(values.newView)})`;
  return `Loss value (${viewName(values.oldView)} → ${viewName(values.newView)})`;
}

function ValueRow({ label, row }: { label: string; row: ValueDeltaView }) {
  const changed = row.delta !== null && row.delta !== '0';
  return (
    <tr className={changed ? 'font-medium' : 'text-muted-foreground'} data-testid="restatement-value">
      <th className="px-2 text-left font-normal">{label}</th>
      <Amount value={row.old} currency={row.currency} />
      <Amount value={row.new} currency={row.currency} />
      <Amount value={row.delta} currency={row.currency} />
    </tr>
  );
}

/**
 * The loss value a restatement changes (QA audit P-2), in the display currency: each revision in its own
 * default valuation view, as the server valued it; the change is the server's. A value-only restatement
 * (new policy or rate, quantities unchanged) shows here.
 */
export function RestatementValueRows({ values }: { values: RestatementValuesView | null | undefined }) {
  const { currency } = useDisplayCurrency();
  if (!values || values.currencies.length === 0) return null;
  const label = valueLabel(values);
  return (
    <>
      {entriesInCurrency(values.currencies, (row) => row.currency, currency).map((row) => (
        <ValueRow key={row.currency} label={label} row={row} />
      ))}
    </>
  );
}
