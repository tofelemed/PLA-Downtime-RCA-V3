/** Calendar used to display dates: ISO Gregorian or Solar Hijri (Jalali, Intl `persian`). */
export type CalendarSystem = 'gregorian' | 'persian';

/** Digits used in displayed dates: Latin `0-9` (default) or Persian `۰-۹`. */
export type DigitSystem = 'latin' | 'persian';

/** Tenant display preference for dates (calendar and digits). */
export interface CalendarPreference {
  calendar: CalendarSystem;
  digits: DigitSystem;
}

/** Gregorian with Latin digits: what every screen shows when no preference is set. */
export const DEFAULT_CALENDAR_PREFERENCE: CalendarPreference = { calendar: 'gregorian', digits: 'latin' };

/** Options for formatting an instant: the plant IANA zone (never the browser zone) and the preference. */
export interface DateDisplayOptions {
  timeZone: string;
  calendar?: CalendarSystem;
  digits?: DigitSystem;
}

/** True for `'gregorian'` and `'persian'`. */
export function isCalendarSystem(value: unknown): value is CalendarSystem {
  return value === 'gregorian' || value === 'persian';
}

/** True for `'latin'` and `'persian'`. */
export function isDigitSystem(value: unknown): value is DigitSystem {
  return value === 'latin' || value === 'persian';
}
