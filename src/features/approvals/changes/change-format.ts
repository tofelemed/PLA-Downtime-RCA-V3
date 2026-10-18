/** Fraction digits a plain number needs (at most 4), so `0.985` is not shown as `0.99` and `600000` stays whole. */
export function fractionDigitsOf(value: string): number {
  const fraction = value.split('.')[1]?.replace(/0+$/, '') ?? '';
  return Math.min(fraction.length, 4);
}

/** Enum-like server words (`contribution_margin`) read as words; free text stays as written. */
export function wordsOf(value: string): string {
  return /^[a-z0-9]+(_[a-z0-9]+)+$/.test(value) ? value.replace(/_/g, ' ') : value;
}
