import type { DigitSystem } from './calendar-types';

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
/** U+066B ARABIC DECIMAL SEPARATOR and U+066C ARABIC THOUSANDS SEPARATOR, used with Persian digits. */
export const PERSIAN_DECIMAL_SEPARATOR = '\u066B';
export const PERSIAN_GROUP_SEPARATOR = '\u066C';

/** Rewrites Latin digits `0-9` as Persian `۰-۹` when `digits` is `'persian'`; otherwise unchanged. */
export function toDigits(text: string, digits: DigitSystem = 'latin'): string {
  if (digits !== 'persian') return text;
  return text.replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

/**
 * Number text (`-12,345.67`, `87.5 %`, `1,234 min`) in the plant's digits: with Persian digits a `.` or
 * `,` between two digits becomes `٫` / `٬` (`%` and the minus sign stay as they are); Latin text is
 * returned unchanged. For displayed numbers only — never for identifiers, inputs, exports or API payloads.
 */
export function localizeNumber(text: string, digits: DigitSystem = 'latin'): string {
  if (digits !== 'persian') return text;
  const separated = text.replace(/(\d)([.,])(?=\d)/g, (_match, digit: string, separator: string) =>
    `${digit}${separator === '.' ? PERSIAN_DECIMAL_SEPARATOR : PERSIAN_GROUP_SEPARATOR}`,
  );
  return toDigits(separated, digits);
}

/** Rewrites Persian `۰-۹` and Arabic-Indic `٠-٩` digits as Latin `0-9` (for parsing typed input). */
export function toLatinDigits(text: string): string {
  return text.replace(/[۰-۹٠-٩]/g, (d) => {
    const persian = PERSIAN_DIGITS.indexOf(d);
    return String(persian >= 0 ? persian : ARABIC_INDIC_DIGITS.indexOf(d));
  });
}

/** Typed number text with Persian/Arabic digits and separators (`۱٬۲۳۴٫۵`) as Latin (`1,234.5`). */
export function toLatinNumber(text: string): string {
  return toLatinDigits(text).replace(new RegExp(PERSIAN_DECIMAL_SEPARATOR, 'g'), '.').replace(new RegExp(PERSIAN_GROUP_SEPARATOR, 'g'), ',');
}
