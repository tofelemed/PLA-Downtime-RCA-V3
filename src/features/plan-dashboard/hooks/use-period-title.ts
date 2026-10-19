import { useProductionPeriod } from '@/api/v2/queries/production-periods';
import { useCalendarPreference } from '@/lib/dates';
import { periodTitle } from '../model/period-title';

/** The period page title (unit — date · shift) once the period is loaded; `fallback` until then. */
export function usePeriodTitle(periodId: string | null, unitName: string, fallback: string): string {
  const period = useProductionPeriod(periodId);
  const preference = useCalendarPreference();
  const detail = period.data?.data;
  if (!detail) return fallback;
  return periodTitle({ unitName, localDate: detail.localDate, shiftName: detail.shiftName }, preference);
}
