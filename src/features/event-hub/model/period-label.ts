import { formatOperationalDate, type CalendarPreference } from '@/lib/dates';

/** Shift name of a period that spans its whole operational day (day grain, declared mode). */
const DAY_PERIOD = 'Day';

/**
 * A production period in words, the same on every event view (QA L14): "2026-10-17 · Shift A" for a shift,
 * "2026-10-29 · Day" for a day-grain period (as the plan-dashboard period title says it).
 */
export function periodLabel(localDate: string, shiftName: string | null | undefined, preference: CalendarPreference): string {
  const day = formatOperationalDate(localDate, preference);
  if (shiftName === DAY_PERIOD) return `${day} · Day`;
  return shiftName ? `${day} · Shift ${shiftName}` : day;
}
