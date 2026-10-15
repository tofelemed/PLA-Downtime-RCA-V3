import { FX_PROVISIONAL } from '../../domain/valuation/valuation-totals';
import { ReviewedValuation } from '../../reconciliation/reviewed-valuation';
import { NO_VALUE, plantMoney } from './plant-format';
import { DigitSystem } from '../../tenant/tenant-display-settings';

/** A loss value as printed, and whether it used a provisional FX rate (SME V7). */
export interface PrintedValue {
  text: string;
  provisional: boolean;
}

const NOT_VALUED: PrintedValue = { text: 'Not valued', provisional: false };

/**
 * The currency a value is printed in: the display currency when the approved policy reports in it,
 * otherwise the policy's first reporting currency (the figure is shown rather than hidden, like the
 * screens' `entriesInCurrency`). Nothing is converted here.
 */
export function printedCurrency(
  valuation: ReviewedValuation,
  wanted: string,
): string | null {
  if (valuation.currencies.includes(wanted)) return wanted;
  return valuation.currencies[0] ?? null;
}

/** The slice's loss value in the default view of the approved valuation. */
export function sliceValue(
  valuation: ReviewedValuation | undefined,
  sliceId: string,
  wanted: string,
  digits: DigitSystem,
): PrintedValue {
  if (!valuation) return NOT_VALUED;
  const currency = printedCurrency(valuation, wanted);
  const total = valuation.slices.find(
    (s) =>
      s.sliceId === sliceId &&
      s.view === valuation.defaultView &&
      s.currency === currency,
  );
  if (!total || !currency) return { text: NO_VALUE, provisional: false };
  const provisional =
    (total.fxProvisionalLines ?? 0) > 0 ||
    total.reasons.includes(FX_PROVISIONAL);
  if (total.amount === null || total.status === 'unvalued') {
    return { ...NOT_VALUED, provisional };
  }
  const text = plantMoney(total.amount, currency, digits);
  return {
    text: total.status === 'valued' ? text : `${text} (partly valued)`,
    provisional,
  };
}

/** A loss line's value (candidate or own line) in the default view. */
export function lineValue(
  valuation: ReviewedValuation | undefined,
  line: { source: 'candidate' | 'line'; id: string },
  wanted: string,
  digits: DigitSystem,
): PrintedValue {
  if (!valuation) return NOT_VALUED;
  const currency = printedCurrency(valuation, wanted);
  const view = valuation.lines
    .find((l) => l.source === line.source && l.id === line.id)
    ?.views.find((v) => v.view === valuation.defaultView);
  const amount = view?.amounts.find((a) => a.currency === currency);
  if (!view || !amount || !currency || amount.amount === null) {
    return NOT_VALUED;
  }
  return {
    text: plantMoney(amount.amount, currency, digits),
    provisional: amount.provisional === true,
  };
}
