import type { ApprovedImpactView } from '@/api/v2/types/rca';
import { currencyDigits, entriesInCurrency } from '@/features/display-currency/money-format';
import { useDisplayCurrency } from '@/features/display-currency/use-display-currency';
import { humanize } from '@/features/ux-kit/labels';
import { Quantity } from '@/features/ux-kit/quantity';

/**
 * Approved historical loss from the ledger (approved revisions only, contribution margin view): one row
 * per loss kind and unit, then the value in the user's display currency (the server reports each reporting
 * currency); a currency without a full valuation says so.
 */
export function ApprovedImpact({ impact }: { impact: ApprovedImpactView }) {
  const { currency } = useDisplayCurrency();
  if (impact.lines === 0) {
    return <p className="text-sm text-muted-foreground" data-testid="approved-impact-none">No approved loss yet (no approved period carries a line of this cause).</p>;
  }
  return (
    <div className="space-y-1 text-sm" data-testid="approved-impact">
      <ul>
        {impact.quantities.map((row) => (
          <li key={`${row.kind}:${row.uom ?? '-'}`}>
            {humanize(row.kind)}: <Quantity value={row.quantity} uom={row.uom} />
          </li>
        ))}
      </ul>
      <ul>
        {entriesInCurrency(impact.values, (row) => row.currency, currency).map((row) => (
          <li key={row.currency}>
            {row.currency}:{' '}
            {row.amount === null ? (
              <span className="text-muted-foreground">Not valued ({row.unvaluedLines} of {row.valuedLines + row.unvaluedLines} lines without a value)</span>
            ) : (
              <Quantity value={row.amount} uom={row.currency} fractionDigits={currencyDigits(row.currency)} />
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{impact.lines} approved line(s). {impact.basis}.</p>
    </div>
  );
}
