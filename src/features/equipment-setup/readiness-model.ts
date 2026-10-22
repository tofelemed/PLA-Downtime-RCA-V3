import type { EquipmentReadinessQuery } from '@/api/v2/queries/equipment-readiness';
import { DAY_MS } from '@/api/v2/queries/time-window';
import type { ReadinessCheckView, ReadinessStatus } from '@/api/v2/types/equipment-readiness';
import { rangeFromDates, type InstantRange } from '@/features/ux-kit/date-inputs';
import { productionDayWindow } from '@/features/ux-kit/production-day-window';
import { addCalendarDays, utcToPlantLocal } from '@/lib/dates';

export interface ReadinessFilters { productId: string; operatingMode: string; range: InstantRange }
export const STATUS_LABELS: Record<ReadinessStatus, string> = { ready: 'Passed', missing: 'Missing', needs_attention: 'Needs attention', not_checked: 'Not checked', optional: 'Optional' };
export function stepReadiness(checks: ReadinessCheckView[]): ReadinessStatus {
  if (!checks.length) return 'not_checked';
  for (const status of ['missing', 'needs_attention', 'not_checked', 'optional'] as const) if (checks.some((check) => check.status === status)) return status;
  return 'ready';
}
export function validReadinessRange(range: InstantRange): boolean {
  if (!range) return false;
  const span = Date.parse(range.to ?? '') - Date.parse(range.from ?? '');
  return span > 0 && span <= 31 * DAY_MS;
}
/**
 * The default readiness window: the last whole production day, as the inclusive day picker shows it
 * (QA L14: "To (inclusive)"). The picker holds calendar dates; `productionDayWindow` turns them into
 * production days when the query is sent (QA re-test N2).
 */
export function lastPlantDay(timezone: string, now: number = Date.now(), dayStart = '00:00'): InstantRange {
  const local = utcToPlantLocal(new Date(now).toISOString(), timezone);
  const today = local.slice(11, 16) >= dayStart ? local.slice(0, 10) : addCalendarDays(local.slice(0, 10), -1);
  const day = addCalendarDays(today, -1);
  return rangeFromDates({ start: day, end: day }, timezone);
}
export function readinessQuery(unitId: string, filters: ReadinessFilters, day: { start: string; timezone: string }): EquipmentReadinessQuery | null {
  if (!validReadinessRange(filters.range)) return null;
  const { from, to } = productionDayWindow(filters.range, day.start, day.timezone);
  if (!from || !to) return null;
  return { unitId, productId: filters.productId || undefined, operatingMode: filters.operatingMode, from, to };
}
