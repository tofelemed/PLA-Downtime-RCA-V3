/** Calendar a tenant's dates are displayed in (display only; storage and exports stay ISO Gregorian). */
export const CALENDAR_SYSTEMS = ['gregorian', 'persian'] as const;
export type CalendarSystem = (typeof CALENDAR_SYSTEMS)[number];

/** Digit shapes a tenant's numbers and dates are displayed with. */
export const DIGIT_SYSTEMS = ['latin', 'persian'] as const;
export type DigitSystem = (typeof DIGIT_SYSTEMS)[number];

export const DEFAULT_CALENDAR_SYSTEM: CalendarSystem = 'gregorian';
export const DEFAULT_DIGIT_SYSTEM: DigitSystem = 'latin';
