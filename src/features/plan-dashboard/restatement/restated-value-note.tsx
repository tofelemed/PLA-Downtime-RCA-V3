import { Link } from 'react-router-dom';
import { useRestatement } from '@/api/v2/queries/restatement';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import { entriesInCurrency, formatCurrencyAmount } from '@/features/display-currency/money-format';
import { useDisplayCurrency } from '@/features/display-currency/use-display-currency';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

const amount = (value: string | null, currency: string, digits: ReturnType<typeof useNumberFormat>['digits']) =>
  value === null ? `— ${currency} (not valued)` : formatCurrencyAmount(value, currency, digits);

/**
 * QA planning (Value note): when the shown revision restates an approved one and its loss value changed, the
 * Value section says so — old → new in the display currency, the server's restatement figures only — and
 * links to the restatement on Review & close. Nothing for a period never restated or a quantity-only change.
 */
export function RestatedValueNote({ view, reviewHref }: { view: ReconciliationView; reviewHref: string }) {
  const { currency } = useDisplayCurrency();
  const { digits } = useNumberFormat();
  const query = useRestatement(view.revision.supersedesId ? view.periodId : null, view.revision.revision);
  const values = query.data?.values;
  const changed = (values?.currencies ?? []).filter((row) => row.delta !== null && row.delta !== '0');
  const [row] = entriesInCurrency(changed, (r) => r.currency, currency);
  if (!query.data || !row) return null;
  return (
    <p className="rounded-md border p-2 text-sm" data-testid="restated-value-note">
      Restated from approved revision {query.data.supersededRevision}: loss value was {amount(row.old, row.currency, digits)}, now {amount(row.new, row.currency, digits)}.{' '}
      <Link className="underline underline-offset-2" to={`${reviewHref}#restatement`}>
        See the restatement in Review &amp; close
      </Link>
    </p>
  );
}
