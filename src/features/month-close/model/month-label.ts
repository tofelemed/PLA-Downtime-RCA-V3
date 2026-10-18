import { monthNames, parsePlantMonth, toDigits, toLatinDigits, type CalendarSystem, type DigitSystem } from '@/lib/dates';

/**
 * A plant month key (`YYYY-MM`, in the calendar the server states) as words: `Mehr 1405` on a Persian
 * plant, `September 2026` otherwise, with the plant's digits. A malformed key is shown as sent.
 */
export function monthLabelOf(monthKey: string, calendar: CalendarSystem, digits: DigitSystem): string {
  const parsed = parsePlantMonth(monthKey);
  if (!parsed) return monthKey;
  return `${monthNames(calendar)[parsed.month - 1]} ${toDigits(String(parsed.year), digits)}`;
}

const normalized = (text: string) => toLatinDigits(text).trim().replace(/\s+/g, ' ').toLowerCase();

/** A typed confirmation names the month: same words and number, ignoring case, spacing and digit system. */
export function typedMonthMatches(typed: string, label: string): boolean {
  return normalized(typed) !== '' && normalized(typed) === normalized(label);
}
