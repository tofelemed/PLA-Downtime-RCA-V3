import { useMemo } from 'react';
import { type DigitSystem, localizeNumber, useCalendarPreference } from '@/lib/dates';
import { formatDecimal, formatNumber } from './format/decimal';

/** Number formatters bound to the plant's digits setting (Latin or Persian digits and separators). */
export interface NumberFormat {
  digits: DigitSystem;
  /** a decimal string from the API: `"12345.678"` → `"12,345.68"` / `"۱۲٬۳۴۵٫۶۸"` */
  decimal: (value: string | null | undefined, fractionDigits?: number) => string;
  /** a JS number (count, length, chart tick): `1234` → `"1,234"` / `"۱٬۲۳۴"` */
  number: (value: number | null | undefined, fractionDigits?: number) => string;
  /** a chart axis tick: whole numbers without decimals (`2,500`), others with two (`0.25`) */
  axis: (value: number) => string;
  /** number text already formatted in Latin digits (`"87.5 %"`) in the plant's digits */
  text: (latin: string) => string;
}

/**
 * The plant's number formatters for every displayed number (quantities, money, counts, ratios, chart
 * ticks). Re-created when the digits setting changes, so the screen re-renders with it. Never for form
 * input values, exports, URLs, payloads or identifiers — those keep Latin digits.
 */
export function useNumberFormat(): NumberFormat {
  const { digits } = useCalendarPreference();
  return useMemo(
    () => ({
      digits,
      decimal: (value, fractionDigits = 2) => formatDecimal(value, fractionDigits, digits),
      number: (value, fractionDigits = 0) => formatNumber(value, fractionDigits, digits),
      axis: (value) => formatNumber(value, Number.isInteger(value) ? 0 : 2, digits),
      text: (latin) => localizeNumber(latin, digits),
    }),
    [digits],
  );
}
