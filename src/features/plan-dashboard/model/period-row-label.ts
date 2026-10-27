import type { PeriodSummaryView } from '@/api/v2/types/period-overview';
import { formatOperationalDate, type CalendarDisplayOptions } from '@/lib/dates';

/** "2026-10-26 · A" for a shift period, "2026-10-26 · Day" for a period spanning its operational day. */
export function periodRowLabel(row: Pick<PeriodSummaryView, 'localDate' | 'shiftName'>, isDay: boolean, display: CalendarDisplayOptions = {}): string {
  const date = formatOperationalDate(row.localDate, display);
  if (isDay) return `${date} · Day`;
  return row.shiftName ? `${date} · ${row.shiftName}` : date;
}
