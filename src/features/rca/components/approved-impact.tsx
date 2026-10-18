import type { ApprovedImpactView } from '@/api/v2/types/rca';
import { currencyDigits, entriesInCurrency } from '@/features/display-currency/money-format';
import { useDisplayCurrency } from '@/features/display-currency/use-display-currency';
import { humanize } from '@/features/ux-kit/labels';
import { Quantity } from '@/features/ux-kit/quantity';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

const VIEW_LABELS: Readonly<Record<string, string>> = {
  contribution_margin: 'Contribution margin',
  standard_cost: 'Standard cost',
  economic_impact: 'Economic impact',
};

/**
 * Approved historical loss from the ledger (approved revisions only, the valuation policy's default view —
 * economic impact from policy version 3; older packages: contribution margin): one row per loss kind and
 * unit, then the value in the user's display currency (the server reports each reporting currency); a
 * currency without a full valuation says so, and a provisional exchange rate is named.
 */
export function ApprovedImpact({ impact }: { impact: ApprovedImpactView }) {
  const { number } = useNumberFormat();
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
      <p className="text-xs text-muted-foreground" data-testid="approved-impact-view">
        Value: {VIEW_LABELS[impact.view ?? 'contribution_margin']}
      </p>
      <ul>
        {entriesInCurrency(impact.values, (row) => row.currency, currency).map((row) => (
          <li key={row.currency}>
            {row.currency}:{' '}
            {row.amount === null ? (
              <span className="text-muted-foreground">Not valued ({row.unvaluedLines} of {row.valuedLines + row.unvaluedLines} lines without a value)</span>
            ) : (
              <Quantity value={row.amount} uom={row.currency} fractionDigits={currencyDigits(row.currency)} />
            )}
            {row.fxProvisional && (
              <span className="ml-1 text-xs text-warning" data-testid="approved-impact-provisional">
                (provisional exchange rate; revalued when the final rate is approved)
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{number(impact.lines)} approved line(s). {impact.basis}.</p>
    </div>
  );
}
