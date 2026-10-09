import type { DowntimeGroupView } from '@/api/v2/types/reports';
import type { ScheduleClass } from './downtime-filters';

export interface TrendSeries {
  scheduleClass: ScheduleClass;
  groups: readonly DowntimeGroupView[];
}

/** One time bucket of the trend: the server value of each schedule class (decimal strings, absent = none). */
export interface TrendRow {
  key: string;
  label: string;
  values: Partial<Record<ScheduleClass, string>>;
}

/**
 * Lines the per-class server series up by their site-local key (day, ISO week, month or
 * "date shift") in chronological order. Values are placed, never added: the stack is drawn by the chart.
 */
export function trendRows(series: readonly TrendSeries[]): TrendRow[] {
  const rows = new Map<string, TrendRow>();
  for (const { scheduleClass, groups } of series) {
    for (const group of groups) {
      if (group.key === null) continue;
      const row = rows.get(group.key) ?? { key: group.key, label: group.label ?? group.key, values: {} };
      row.values[scheduleClass] = group.value;
      rows.set(group.key, row);
    }
  }
  return [...rows.values()].sort((a, b) => a.key.localeCompare(b.key));
}
