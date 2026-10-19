import { formatOperationalDate, type CalendarPreference } from '@/lib/dates';

/** A production period in words, the same on every event view (QA L14): "2026-10-17 · Shift A". */
export function periodLabel(localDate: string, shiftName: string | null | undefined, preference: CalendarPreference): string {
  const day = formatOperationalDate(localDate, preference);
  return shiftName ? `${day} · Shift ${shiftName}` : day;
}
