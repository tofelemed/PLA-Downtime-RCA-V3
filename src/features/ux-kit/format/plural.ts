import type { DigitSystem } from '@/lib/dates';
import { formatNumber } from './decimal';

/**
 * Digits of the counts in `plural` sentences when no formatter is passed: the acting plant's setting, kept
 * here by `CalendarPreferenceProvider` (settings audit, 21 Oct 2026). Counts in sentences are display text
 * only, so every one of them follows the plant setting, also those built in pure model functions.
 */
let displayDigits: DigitSystem = 'latin';

/** Called by the plant settings provider whenever the plant's digit setting is known or changes. */
export function setPluralDigits(digits: DigitSystem): void {
  displayDigits = digits;
}

/**
 * A count with the right noun (QA: "1 stop(s)", "1 groups"): `plural(1, 'stop', 'stops')` → "1 stop",
 * `plural(1200, 'stop', 'stops')` → "1,200 stops". The count is in the plant's digits
 * (`setPluralDigits`) unless a `formatCount` is passed.
 */
export function plural(count: number, one: string, many: string, formatCount: (value: number) => string = (value) => formatNumber(value, 0, displayDigits)): string {
  return `${formatCount(count)} ${pluralNoun(count, one, many)}`;
}

/** A count inside a sentence ("3 of 5 certified") in the plant's digits, like `plural`. */
export function displayCount(count: number): string {
  return formatNumber(count, 0, displayDigits);
}

/** The noun alone, for a count shown separately (e.g. in `<strong>`): `pluralNoun(1, 'event', 'events')` → "event". */
export function pluralNoun(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}
