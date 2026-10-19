import type { ApprovedImpactView } from '@/api/v2/types/rca';
import { currencyDigits, entriesInCurrency } from '@/features/display-currency/money-format';
import { useDisplayCurrency } from '@/features/display-currency/use-display-currency';
import { humanize } from '@/features/ux-kit/labels';
import { basisSentence, valueBasisLabel } from '@/features/ux-kit/labels/value-basis';
import { Quantity } from '@/features/ux-kit/quantity';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { plural } from '@/features/ux-kit/format/plural';
import { useCapabilities } from '@/features/auth/use-capabilities';

export interface ApprovedImpactProps {
  impact: ApprovedImpactView;
  /** where the value view comes from, after its name ("at link time" for a frozen evidence package) */
  viewNote?: string;
}

/**
 * Approved historical loss from the ledger (approved revisions only, in the value view the server names —
 * older packages: contribution margin): one row per loss kind and unit, then the value in the user's display
 * currency (the server reports each reporting currency); a currency without a full valuation says so, and a
 * provisional exchange rate is named. The basis sentence is the server's (QA M3).
 */
export function ApprovedImpact({ impact, viewNote }: ApprovedImpactProps) {
  const { number } = useNumberFormat();
  // owner 19 Oct 2026 (QA audit): no money for operators
  const { canViewMoney } = useCapabilities();
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
      {canViewMoney && <ApprovedImpactValues impact={impact} viewNote={viewNote} />}
      <p className="text-xs text-muted-foreground">{plural(impact.lines, 'approved line', 'approved lines', number)}. {basisSentence(impact.basis)}</p>
    </div>
  );
}

/** The value view and the value per display currency (only for roles that see money). */
function ApprovedImpactValues({ impact, viewNote }: ApprovedImpactProps) {
  const { currency } = useDisplayCurrency();
  return (
    <>
      <p className="text-xs text-muted-foreground" data-testid="approved-impact-view">
        {valueBasisLabel(impact.view, viewNote)}
      </p>
      <ul>
        {entriesInCurrency(impact.values ?? [], (row) => row.currency, currency).map((row) => (
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
    </>
  );
}
