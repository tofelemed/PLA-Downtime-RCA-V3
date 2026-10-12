import type { DigitSystem } from './calendar-types';

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** Rewrites Latin digits `0-9` as Persian `۰-۹` when `digits` is `'persian'`; otherwise unchanged. */
export function toDigits(text: string, digits: DigitSystem = 'latin'): string {
  if (digits !== 'persian') return text;
  return text.replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

/** Rewrites Persian `۰-۹` and Arabic-Indic `٠-٩` digits as Latin `0-9` (for parsing typed input). */
export function toLatinDigits(text: string): string {
  return text.replace(/[۰-۹٠-٩]/g, (d) => {
    const persian = PERSIAN_DIGITS.indexOf(d);
    return String(persian >= 0 ? persian : ARABIC_INDIC_DIGITS.indexOf(d));
  });
}
