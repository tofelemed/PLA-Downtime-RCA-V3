import { useMemo, type ReactNode } from 'react';
import { CalendarPreferenceContext } from '@/lib/dates';
import { setPluralDigits } from '@/features/ux-kit/format/plural';
import { calendarPreferenceOf, useActingTenant } from './use-tenant-display-settings';

/**
 * Provides the acting plant's calendar system and digits to every date formatter and input
 * (`useCalendarPreference()` in `src/lib/dates`) and to counts in sentences (`plural`). Gregorian / Latin
 * digits until the tenant is known.
 */
export function CalendarPreferenceProvider({ children }: { children: ReactNode }) {
  const tenant = useActingTenant();
  const calendar = tenant.data?.calendarSystem;
  const digits = tenant.data?.digits;
  const value = useMemo(() => calendarPreferenceOf({ calendarSystem: calendar, digits }), [calendar, digits]);
  // counts in sentences built outside React (`plural` in model functions) follow the same digits; set while
  // rendering, before the children that build those sentences render
  setPluralDigits(value.digits);
  return <CalendarPreferenceContext.Provider value={value}>{children}</CalendarPreferenceContext.Provider>;
}
