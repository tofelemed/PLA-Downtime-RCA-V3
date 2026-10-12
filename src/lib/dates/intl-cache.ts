import type { CalendarSystem } from './calendar-types';

/**
 * Cached `Intl.DateTimeFormat` instances (the constructor is expensive and tables format thousands of
 * cells). Locales are fixed — the browser locale and zone are never consulted.
 */
export type FormatterStyle = 'datetime' | 'month';

const PERSIAN_LOCALE = 'en-US-u-ca-persian-nu-latn';

/** `en-CA` gives ISO-ordered numeric dates; month names come from `en-US` (`Sep`, not `Sept.`). */
function localeFor(calendar: CalendarSystem, style: FormatterStyle): string {
  if (calendar === 'persian') return PERSIAN_LOCALE;
  return style === 'month' ? 'en-US' : 'en-CA';
}

const STYLES: Record<FormatterStyle, Intl.DateTimeFormatOptions> = {
  datetime: {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'longOffset',
  },
  month: { year: 'numeric', month: 'short' },
};

const formatters = new Map<string, Intl.DateTimeFormat>();
const zones = new Map<string, string>();

/** `timezone` when `Intl` knows it, otherwise `'UTC'` (shown in the label, so the fallback is visible). */
export function resolveTimeZone(timezone: string): string {
  const known = zones.get(timezone);
  if (known) return known;
  let zone = 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    zone = timezone;
  } catch {
    zone = 'UTC';
  }
  zones.set(timezone, zone);
  return zone;
}

/** The shared formatter for `calendar|zone|style`; `zone` must already be resolved. */
export function getFormatter(calendar: CalendarSystem, zone: string, style: FormatterStyle): Intl.DateTimeFormat {
  const key = `${calendar}|${zone}|${style}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(localeFor(calendar, style), { ...STYLES[style], timeZone: zone });
    formatters.set(key, formatter);
  }
  return formatter;
}
