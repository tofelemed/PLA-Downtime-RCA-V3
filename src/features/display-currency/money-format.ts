import type { DigitSystem } from '@/lib/dates';
import { formatDecimal } from '@/features/ux-kit/format/decimal';

/** Fraction digits per ISO 4217 code for display (D08: IRR without a minor unit, USD 2). */
const CURRENCY_DIGITS: Readonly<Record<string, number>> = { IRR: 0, USD: 2 };

export function currencyDigits(currency: string | null | undefined): number {
  return CURRENCY_DIGITS[currency ?? ''] ?? 2;
}

/** `"1234567.5", "IRR"` → `"1,234,568 IRR"`; `"1234.5", "USD"` → `"1,234.50 USD"` (rounded for display only). */
export function formatCurrencyAmount(amount: string, currency: string, digits?: DigitSystem): string {
  return `${formatDecimal(amount, currencyDigits(currency), digits)} ${currency}`;
}

/**
 * The entries of the display currency. The server reports every amount in each reporting currency, so the
 * browser only chooses which one to show — nothing is converted here. When the server has no entry in
 * that currency (a policy without it), every entry is returned rather than hiding the figures.
 */
export function entriesInCurrency<T>(entries: readonly T[], currencyOf: (entry: T) => string | null, currency: string): T[] {
  const chosen = entries.filter((entry) => currencyOf(entry) === currency);
  return chosen.length > 0 ? chosen : [...entries];
}
