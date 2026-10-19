import { formatDecimal } from '@/features/ux-kit/format/decimal';
import type { DigitSystem } from '@/lib/dates';

/** Fraction digits the rate carries, trailing zeros dropped (the rate is shown unrounded). */
function scaleOf(rate: string): number {
  const fraction = rate.split('.')[1] ?? '';
  return fraction.replace(/0+$/, '').length;
}

/** "1 USD = 600,000 IRR" (QA L21): the server's decimal with thousands separators and every significant digit. */
export function fxRateText(rate: { rate: string; fromCurrency: string; toCurrency: string }, digits?: DigitSystem): string {
  return `1 ${rate.fromCurrency} = ${formatDecimal(rate.rate, scaleOf(rate.rate), digits)} ${rate.toCurrency}`;
}
