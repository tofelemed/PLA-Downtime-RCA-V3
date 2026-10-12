import { createContext, useContext } from 'react';
import { type CalendarPreference, DEFAULT_CALENDAR_PREFERENCE } from './calendar-types';

/**
 * The tenant's calendar preference. The settings feature renders the provider; without one every
 * consumer gets {@link DEFAULT_CALENDAR_PREFERENCE} (Gregorian, Latin digits).
 */
export const CalendarPreferenceContext = createContext<CalendarPreference>(DEFAULT_CALENDAR_PREFERENCE);

/** The calendar preference in scope (defaults when no provider is mounted). */
export function useCalendarPreference(): CalendarPreference {
  return useContext(CalendarPreferenceContext);
}
