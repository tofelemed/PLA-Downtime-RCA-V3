/**
 * Exact decimal arithmetic for reconciliation quantities (the API compares residuals to 1e-6, so floats
 * are not good enough): values are scaled integers with 8 decimal places, as the API stores quantities.
 */
const SCALE = 8;
const FACTOR = 10n ** BigInt(SCALE);

export function parseDec(value: string | number | null | undefined): bigint {
  if (value === null || value === undefined || value === '') return 0n;
  const text = typeof value === 'number' ? value.toFixed(SCALE) : value.trim();
  const negative = text.startsWith('-');
  const [whole, fraction = ''] = text.replace(/^[-+]/, '').split('.');
  const digits =
    BigInt(whole || '0') * FACTOR +
    BigInt((fraction + '0'.repeat(SCALE)).slice(0, SCALE) || '0');
  return negative ? -digits : digits;
}

export function formatDec(value: bigint): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = abs / FACTOR;
  const fraction = (abs % FACTOR)
    .toString()
    .padStart(SCALE, '0')
    .replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}
