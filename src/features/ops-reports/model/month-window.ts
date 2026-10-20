import type { MonthCloseView } from '@/api/v2/types/month-close';
import { plantLocalToUtc } from '@/lib/dates';

/** A financial month's production days `[firstDate, endDate)` as a UTC window starting at the plant's day start. */
export function monthWindow(view: Pick<MonthCloseView, 'firstDate' | 'endDate'>, dayStart: string, timeZone: string): { from: string; to: string } | null {
  const from = plantLocalToUtc(`${view.firstDate}T${dayStart}`, timeZone);
  const to = plantLocalToUtc(`${view.endDate}T${dayStart}`, timeZone);
  return from && to ? { from, to } : null;
}
