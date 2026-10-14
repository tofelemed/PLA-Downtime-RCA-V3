import { type DigitSystem, localizeNumber, toLatinNumber } from '@/lib/dates';

/**
 * Decimal strings from the API (quantities, money, ratios) formatted without going through binary
 * floating point (plan 3.1, API conventions §5): rounding half away from zero on the digits themselves.
 */
const DECIMAL = /^(-?)(\d+)(?:\.(\d+))?$/;

export const MAX_SCALE = 8;

function addOne(digits: string): string {
  const chars = digits.split('');
  for (let i = chars.length - 1; i >= 0; i -= 1) {
    if (chars[i] !== '9') {
      chars[i] = String(Number(chars[i]) + 1);
      return chars.join('');
    }
    chars[i] = '0';
  }
  return `1${chars.join('')}`;
}

/** `value` rounded to `digits` fraction digits, as a plain decimal string (no grouping). */
export function roundDecimal(value: string, digits: number): string | null {
  const match = DECIMAL.exec(value.trim());
  if (!match) return null;
  const [, sign, int, frac = ''] = match;
  const padded = frac.padEnd(digits + 1, '0');
  let kept = `${int}${padded.slice(0, digits)}`;
  if (Number(padded[digits]) >= 5) kept = addOne(kept);
  const intPart = kept.slice(0, kept.length - digits).replace(/^0+(?=\d)/, '') || '0';
  const fracPart = digits > 0 ? `.${kept.slice(kept.length - digits)}` : '';
  const isZero = /^[0.]+$/.test(`${intPart}${fracPart}`);
  return `${sign && !isZero ? '-' : ''}${intPart}${fracPart}`;
}

/**
 * `"12345.678"` → `"12,345.68"` (Persian `digits`: `"۱۲٬۳۴۵٫۶۸"`); non-decimal input is returned
 * unchanged, null/empty → "—". Display only: inputs, exports and payloads keep the canonical string.
 */
export function formatDecimal(value: string | null | undefined, fractionDigits = 2, digits?: DigitSystem): string {
  if (value === null || value === undefined || value.trim() === '') return '—';
  const rounded = roundDecimal(value, fractionDigits);
  if (rounded === null) return value;
  const [int, frac] = rounded.split('.');
  const negative = int.startsWith('-');
  const grouped = (negative ? int.slice(1) : int).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return localizeNumber(`${negative ? '-' : ''}${grouped}${frac !== undefined ? `.${frac}` : ''}`, digits);
}

/** A JS number (a count, a length) as display text: `1234` → `"1,234"`; not finite or absent → "—". */
export function formatNumber(value: number | null | undefined, fractionDigits = 0, digits?: DigitSystem): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return formatDecimal(String(value), fractionDigits, digits);
}

/** `9.50001` → `"9.5"` with `significant` digits, trailing zeros dropped (no grouping); not finite → "—". */
export function formatSignificant(value: number | null | undefined, significant = 4, digits?: DigitSystem): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return localizeNumber(String(Number(value.toPrecision(significant))), digits);
}

export interface DecimalInputResult {
  /** canonical decimal string, or null when the field is empty */
  value: string | null;
  error: string | null;
}

/**
 * Validates typed text as a decimal with at most `scale` fraction digits (no float conversion). Persian
 * or Arabic-Indic digits and separators typed by the user are read as Latin.
 */
export function parseDecimalInput(text: string, scale = MAX_SCALE, allowNegative = false): DecimalInputResult {
  const trimmed = toLatinNumber(text).trim().replace(/,/g, '');
  if (trimmed === '') return { value: null, error: null };
  const match = DECIMAL.exec(trimmed);
  if (!match) return { value: null, error: 'Enter a number' };
  if (match[1] && !allowNegative) return { value: null, error: 'Must not be negative' };
  if ((match[3] ?? '').length > scale) return { value: null, error: `At most ${scale} decimal places` };
  const int = match[2].replace(/^0+(?=\d)/, '');
  return { value: `${match[1]}${int}${match[3] ? `.${match[3]}` : ''}`, error: null };
}
