import type { TrendGroup } from '@/api/v2/types/pla-analytics';
import { formatOperationalDate, toDigits, type CalendarDisplayOptions } from '@/lib/dates';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const WEEK = /^(\d{4})-W(\d{2})$/;
const MONTH = /^(\d{4})-(\d{2})$/;

/** Last day of a `YYYY-MM` month as `YYYY-MM-DD` (calendar arithmetic for the label only). */
function monthEnd(year: number, month: number): string {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

/**
 * Display label of a server bucket key (site-local operational dates, AN03): a day in the plant calendar,
 * "<day> <shift>", "Week 40 of 2026" (ISO) or "Week from <Saturday>" (Saturday weeks), or a month as its date range (server buckets stay Gregorian, so a
 * Persian calendar shows the range instead of a month name). Unknown keys are returned as they are.
 */
export function bucketLabel(key: string | null, groupBy: TrendGroup | string, pref: CalendarDisplayOptions): string {
  if (!key) return '—';
  if (groupBy === 'shift') {
    const [date, ...shift] = key.split(' ');
    return DATE.test(date) ? `${formatOperationalDate(date, pref)} ${shift.join(' ')}`.trim() : key;
  }
  const week = WEEK.exec(key);
  if (week) return toDigits(`Week ${Number(week[2])} of ${week[1]}`, pref.digits);
  // a plant whose week starts on Saturday (DT-10) keys each week by its first day
  if (groupBy === 'week' && DATE.test(key)) return `Week from ${formatOperationalDate(key, pref)}`;
  const month = MONTH.exec(key);
  if (month) {
    const start = `${key}-01`;
    return `${formatOperationalDate(start, pref)} – ${formatOperationalDate(monthEnd(Number(month[1]), Number(month[2])), pref)}`;
  }
  return DATE.test(key) ? formatOperationalDate(key, pref) : key;
}
