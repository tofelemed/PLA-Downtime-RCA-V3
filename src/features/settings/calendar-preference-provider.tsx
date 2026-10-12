import { useMemo, type ReactNode } from 'react';
import { CalendarPreferenceContext } from '@/lib/dates';
import { calendarPreferenceOf, useActingTenant } from './use-tenant-display-settings';

/**
 * Provides the acting plant's calendar system and digits to every date formatter and input
 * (`useCalendarPreference()` in `src/lib/dates`). Gregorian / Latin digits until the tenant is known.
 */
export function CalendarPreferenceProvider({ children }: { children: ReactNode }) {
  const tenant = useActingTenant();
  const calendar = tenant.data?.calendarSystem;
  const digits = tenant.data?.digits;
  const value = useMemo(() => calendarPreferenceOf({ calendarSystem: calendar, digits }), [calendar, digits]);
  return <CalendarPreferenceContext.Provider value={value}>{children}</CalendarPreferenceContext.Provider>;
}
