import type { CalendarWarning, ShiftInstancePreview } from '@/api/v2/types/calendars';
import { humanize } from '@/features/ux-kit/labels';

/**
 * Display helpers of the calendar preview (plan 3.4, CAL02). Nothing here derives schedule figures: the
 * instances, their offsets and durations and the scheduled total are the server's; these only label
 * offsets and match the server's warnings to the rows they are about.
 */
export const DST_CODES = new Set(['dst_gap', 'dst_repeat', 'dst_split']);

/** Minutes east of UTC → `+03:30` / `-05:00`. */
export function offsetLabel(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

const rowKey = (localDate: string, shiftName: string | null) => `${localDate}|${shiftName ?? ''}`;

/** Server warnings per (operational date, shift); a warning without a shift applies to the whole date. */
export function warningsByRow(warnings: readonly CalendarWarning[]): Map<string, CalendarWarning[]> {
  const map = new Map<string, CalendarWarning[]>();
  for (const warning of warnings) {
    const key = rowKey(warning.localDate, warning.shiftName);
    map.set(key, [...(map.get(key) ?? []), warning]);
  }
  return map;
}

export function warningsOf(map: Map<string, CalendarWarning[]>, instance: ShiftInstancePreview): CalendarWarning[] {
  return [...(map.get(rowKey(instance.localDate, instance.shiftName)) ?? []), ...(map.get(rowKey(instance.localDate, null)) ?? [])];
}

export function isDstWarning(warning: CalendarWarning): boolean {
  return DST_CODES.has(warning.code);
}

const TEXT: Record<string, string> = {
  dst_gap: 'Clock jumps forward: the missing hour contributes no time',
  dst_repeat: 'Clock falls back: the repeated hour is counted twice',
  dst_split: 'A shift boundary falls in the repeated hour: two instances with distinct offsets',
  holiday_reduced: 'Reduced holiday: shifts kept (no reduction rule decided yet)',
  crew_conflict: 'More than one crew rotates onto this shift',
  timezone_fallback: 'The site has no valid time zone: UTC was used',
};

export function warningText(warning: CalendarWarning): string {
  return TEXT[warning.code] ?? humanize(warning.code);
}
