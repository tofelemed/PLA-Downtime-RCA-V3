import type { ApprovedImpactView } from '@/api/v2/types/rca';
import { Quantity } from '@/features/ux-kit/quantity';

const CURRENCY_DIGITS: Readonly<Record<string, number>> = { IRR: 0, USD: 2 };

/**
 * Approved historical loss from the ledger (approved revisions only, contribution margin view): one row
 * per loss kind and unit, one per reporting currency; a currency without a full valuation says so.
 */
export function ApprovedImpact({ impact }: { impact: ApprovedImpactView }) {
  if (impact.lines === 0) {
    return <p className="text-sm text-muted-foreground" data-testid="approved-impact-none">No approved loss yet (no approved period carries a line of this cause).</p>;
  }
  return (
    <div className="space-y-1 text-sm" data-testid="approved-impact">
      <ul>
        {impact.quantities.map((row) => (
          <li key={`${row.kind}:${row.uom ?? '-'}`}>
            {row.kind.replace(/_/g, ' ')}: <Quantity value={row.quantity} uom={row.uom} />
          </li>
        ))}
      </ul>
      <ul>
        {impact.values.map((row) => (
          <li key={row.currency}>
            {row.currency}:{' '}
            {row.amount === null ? (
              <span className="text-muted-foreground">Not valued ({row.unvaluedLines} of {row.valuedLines + row.unvaluedLines} lines without a value)</span>
            ) : (
              <Quantity value={row.amount} uom={row.currency} fractionDigits={CURRENCY_DIGITS[row.currency] ?? 2} />
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{impact.lines} approved line(s). {impact.basis}.</p>
    </div>
  );
}
