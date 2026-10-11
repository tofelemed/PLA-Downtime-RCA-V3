/**
 * Fraction digits shown per ISO 4217 code (VAL03, D08: IRR without a minor unit, USD 2). Mirrors
 * `currencyDigits` of the frontend `src/features/display-currency/money-format.ts`, so an export shows
 * the same figure as the screen; an unknown code gets 2.
 */
const CURRENCY_MINOR_UNITS: Readonly<Record<string, number>> = {
  IRR: 0,
  USD: 2,
};

const DEFAULT_MINOR_UNITS = 2;

export function currencyMinorUnits(
  currency: string | null | undefined,
): number {
  return CURRENCY_MINOR_UNITS[currency ?? ''] ?? DEFAULT_MINOR_UNITS;
}
