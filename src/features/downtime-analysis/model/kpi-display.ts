import type { KpiAggregateView, ReliabilityRowView } from '@/api/v2/types/reports';
import { formatDecimal, roundDecimal } from '@/features/ux-kit/format/decimal';

/** How a summary tile shows its server value (the browser formats, it never computes). */
export type TileKind = 'duration' | 'count' | 'ratio';

export interface TileSpec {
  metric: string;
  title: string;
  kind: TileKind;
  /** the KPI's definition as the API computes it (KPI05 / KPI06 labels) */
  note: string;
}

/** Summary tiles in display order; titles and notes follow KPI05–KPI06 and the 2.7 decisions. */
export const SUMMARY_TILES: readonly TileSpec[] = [
  { metric: 'downtime_total', title: 'Total downtime', kind: 'duration', note: 'Union of stop time in the window' },
  { metric: 'downtime_planned', title: 'Planned', kind: 'duration', note: 'Stops classed planned' },
  { metric: 'downtime_unplanned', title: 'Unplanned', kind: 'duration', note: 'Stops classed unplanned' },
  { metric: 'microstop_time', title: 'Micro-stops', kind: 'duration', note: 'Below the OEE-policy threshold; stay in run time' },
  { metric: 'unknown_time', title: 'Unknown', kind: 'duration', note: 'Stop time with schedule class unknown' },
  { metric: 'stop_count', title: 'Stops', kind: 'count', note: 'Stop occurrences starting in the window' },
  { metric: 'carry_in_count', title: 'Carry-in stops', kind: 'count', note: 'Started before the window, still counted separately' },
  { metric: 'mean_stop_duration', title: 'Mean completed stop', kind: 'duration', note: 'Cohort: completed stops ending in the window (open stops censored)' },
  { metric: 'scheduled_availability', title: 'Scheduled availability', kind: 'ratio', note: 'Run time ÷ scheduled time' },
  { metric: 'onstream_factor', title: 'Onstream factor', kind: 'ratio', note: 'Denominator: calendar time' },
];

const REASONS: Readonly<Record<string, string>> = {
  no_data: 'No calculated periods',
  no_scheduled_time: 'No scheduled time',
  no_completed_stops: 'No completed stops in the window',
  no_failures: 'No failures in the window',
  no_restored_failures: 'No restored failures in the window',
  repair_evidence_missing: 'No repair evidence',
  incomplete_periods: 'Some periods are not calculated',
  provisional_inputs: 'Provisional inputs',
  incompatible_policies: 'Different OEE policies: not combined',
  above_100_percent: 'Above 100 % (kept as an exception)',
  input_missing: 'Inputs missing',
};

/** Human text of a server reason code (unknown codes are shown as they are). */
export function reasonText(reason: string | null | undefined): string | null {
  if (!reason) return null;
  return reason
    .split(',')
    .map((code) => REASONS[code] ?? code.replace(/_/g, ' '))
    .join('; ');
}

/** `"0.875"` → `"87.5 %"`: the decimal point moved on the digits, never through a float. */
export function formatRatio(value: string | null | undefined, fractionDigits = 1): string {
  if (value === null || value === undefined || value === '') return '—';
  const match = /^(-?)(\d+)(?:\.(\d*))?$/.exec(value.trim());
  if (!match) return value;
  const [, sign, int, frac = ''] = match;
  const padded = frac.padEnd(2, '0');
  const shifted = `${sign}${int}${padded.slice(0, 2)}.${padded.slice(2) || '0'}`;
  const rounded = roundDecimal(shifted, fractionDigits);
  return `${rounded ?? shifted} %`;
}

/** A count from the API ("3.0000000000" → "3"). */
export function formatCount(value: string | null | undefined): string {
  return formatDecimal(value ?? null, 0);
}

export function findMetric(views: readonly KpiAggregateView[] | undefined, metric: string): KpiAggregateView | undefined {
  return views?.find((view) => view.metric === metric);
}

/** True when the unknown tile is above zero: known downtime is then a lower bound (DT04). */
export function hasUnknownTime(views: readonly KpiAggregateView[] | undefined): boolean {
  const value = findMetric(views, 'unknown_time')?.value;
  return value !== null && value !== undefined && /[1-9]/.test(value);
}

export interface RestoreColumn {
  /** "MTTR" only with repair evidence; otherwise the labelled mean downtime to restore (KPI08 / D13) */
  title: 'MTTR' | 'Mean downtime to restore';
  view: KpiAggregateView;
}

export function restoreColumn(row: ReliabilityRowView): RestoreColumn {
  if (row.mttr.value !== null) return { title: 'MTTR', view: row.mttr };
  return { title: 'Mean downtime to restore', view: row.meanDowntimeToRestore };
}

/** The restore column title of a whole table: MTTR only when every row has repair evidence. */
export function restoreTitle(rows: readonly ReliabilityRowView[]): RestoreColumn['title'] {
  return rows.length > 0 && rows.every((row) => row.mttr.value !== null) ? 'MTTR' : 'Mean downtime to restore';
}
