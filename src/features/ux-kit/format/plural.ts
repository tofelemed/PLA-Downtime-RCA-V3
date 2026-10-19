import { formatNumber } from './decimal';

/**
 * A count with the right noun (QA: "1 stop(s)", "1 groups"): `plural(1, 'stop', 'stops')` → "1 stop",
 * `plural(1200, 'stop', 'stops')` → "1,200 stops". Pass the plant's number formatter
 * (`useNumberFormat().number`) as `formatCount` to show the count in the plant's digits.
 */
export function plural(count: number, one: string, many: string, formatCount: (value: number) => string = (value) => formatNumber(value)): string {
  return `${formatCount(count)} ${pluralNoun(count, one, many)}`;
}

/** The noun alone, for a count shown separately (e.g. in `<strong>`): `pluralNoun(1, 'event', 'events')` → "event". */
export function pluralNoun(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}
