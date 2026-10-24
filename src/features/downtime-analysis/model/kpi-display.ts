import type { KpiAggregateView, ReliabilityRowView } from '@/api/v2/types/reports';
import { type DigitSystem, localizeNumber } from '@/lib/dates';
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
  { metric: 'downtime_total', title: 'Total downtime', kind: 'duration', note: 'Union of stop time in the calendar window, including time outside the schedule' },
  { metric: 'downtime_in_schedule', title: 'Downtime in schedule', kind: 'duration', note: 'Stop time inside the schedule: scheduled time minus this is the run time of scheduled availability' },
  { metric: 'downtime_planned', title: 'Planned', kind: 'duration', note: 'Stops classed planned' },
  { metric: 'downtime_unplanned', title: 'Unplanned', kind: 'duration', note: 'Stops classed unplanned' },
  { metric: 'downtime_external', title: 'External', kind: 'duration', note: 'Stops classed external (outside the plant’s control, e.g. grid power)' },
  { metric: 'downtime_equivalent', title: 'Equivalent downtime', kind: 'duration', note: 'Partial-impact events: lost rate as time at the reference rate (not stopped time)' },
  { metric: 'microstop_time', title: 'Micro-stops', kind: 'duration', note: 'Below the OEE-policy threshold; stay in run time' },
  { metric: 'unknown_time', title: 'Stops not classed planned/unplanned', kind: 'duration', note: 'Stop time whose schedule class is not set yet (not unrecorded time)' },
  {
    metric: 'downtime_maintenance_overrun',
    title: 'Maintenance overrun',
    kind: 'duration',
    note: 'Planned stops past their approved window: counted as unplanned, not as failures',
  },
  {
    metric: 'coded_downtime_ratio',
    title: 'Stop time coded',
    kind: 'ratio',
    note: 'Share of stop time with a reason code (pilot targets: 95 % by shift end, 99 % at daily approval)',
  },
  { metric: 'stop_count', title: 'Stops', kind: 'count', note: 'Stop occurrences starting in the window' },
  { metric: 'carry_in_count', title: 'Carry-in stops', kind: 'count', note: 'Started before the window, still counted separately' },
  { metric: 'mean_stop_duration', title: 'Mean completed stop', kind: 'duration', note: 'Cohort: completed stops ending in the window (open stops censored)' },
  { metric: 'scheduled_availability', title: 'Scheduled availability', kind: 'ratio', note: 'Run time ÷ scheduled time' },
  { metric: 'onstream_factor', title: 'Onstream factor', kind: 'ratio', note: 'Denominator: calendar time' },
];

/**
 * SME D15: the supplemental controllable view. Its own name and definition; the headline availability
 * keeps external stops and stays on screen. The value is the server's KPI.
 */
export const CONTROLLABLE_TILE: TileSpec = {
  metric: 'controllable_availability',
  title: 'Controllable availability',
  kind: 'ratio',
  note: 'Supplemental view: run time ÷ scheduled time with stops classed external not counted as stops',
};

/** Plan 2.3: what an incomplete downtime card counts, and where the rest of the window is reported. */
export const INCOMPLETE_TEXT =
  'Only calculated periods are counted here. Units/days without a plan or calendar are shown separately on calendar basis in the downtime summary.';

/** Plan 2.3: the basis badge of figures computed over calendar time (the server sends the same `label`). */
export const CALENDAR_BASIS_BADGE = 'Calendar basis — no plan or calendar for these units/days';

/**
 * Plan 2.3: tiles of the calendar-basis total (units/days without a calculation run). The availability is
 * calendar availability, never ISO 22400 availability; values are the server's.
 */
export const CALENDAR_TILES: readonly TileSpec[] = [
  { metric: 'calendar_availability', title: 'Calendar availability', kind: 'ratio', note: '1 − unplanned downtime ÷ calendar time (not ISO 22400 availability)' },
  { metric: 'downtime_total', title: 'Total downtime', kind: 'duration', note: 'Stop time over calendar time' },
  { metric: 'downtime_unplanned', title: 'Unplanned', kind: 'duration', note: 'Stops classed unplanned' },
  { metric: 'stop_count', title: 'Stops', kind: 'count', note: 'Stop occurrences starting in these days' },
  { metric: 'mtbf', title: 'MTBF', kind: 'duration', note: 'Calendar run time ÷ confirmed functional failures' },
];

const REASONS: Readonly<Record<string, string>> = {
  no_calendar_time: 'No calendar time in the window',
  no_data: 'No calculated periods',
  no_scheduled_time: 'No scheduled time',
  no_known_time: 'No state data covers this window',
  no_completed_stops: 'No completed stops in the window',
  no_failures: 'No failures in the window',
  no_restored_failures: 'No restored failures in the window',
  repair_evidence_missing: 'No repair evidence',
  incomplete_periods: 'Some periods are not calculated',
  provisional_inputs: 'Provisional inputs',
  incompatible_policies: 'Different OEE policies: not combined',
  above_100_percent: 'Above 100 % (kept as an exception)',
  input_missing: 'Inputs missing',
  not_by_schedule_class: 'Not split by schedule class',
};

/** Human text of a server reason code (unknown codes are shown as they are). */
export function reasonText(reason: string | null | undefined): string | null {
  if (!reason) return null;
  return reason
    .split(',')
    .map((code) => REASONS[code] ?? code.replace(/_/g, ' '))
    .join('; ');
}

const QUALITY_TEXT: Readonly<Record<string, string>> = {
  provisional: 'Provisional',
  unavailable: 'Not available',
  exception: 'Above 100 %',
};

/** The ⓘ text of a summary tile: its definition, then the server's quality and reason when the figure is not plain. */
export function tileInfo(spec: TileSpec, view: KpiAggregateView | undefined): string {
  if (!view || view.quality === 'ok') return spec.note;
  const quality = QUALITY_TEXT[view.quality] ?? view.quality;
  const reason = reasonText(view.reason);
  return `${spec.note}. ${reason ? `${quality}: ${reason}` : quality}.`;
}

/** `"0.875"` → `"87.5 %"`: the decimal point moved on the digits, never through a float; in the plant's `digits`. */
export function formatRatio(value: string | null | undefined, fractionDigits = 1, digits?: DigitSystem): string {
  if (value === null || value === undefined || value === '') return '—';
  const match = /^(-?)(\d+)(?:\.(\d*))?$/.exec(value.trim());
  if (!match) return value;
  const [, sign, int, frac = ''] = match;
  const padded = frac.padEnd(2, '0');
  const shifted = `${sign}${int}${padded.slice(0, 2)}.${padded.slice(2) || '0'}`;
  const rounded = roundDecimal(shifted, fractionDigits);
  return localizeNumber(`${rounded ?? shifted} %`, digits);
}

/** A count from the API ("3.0000000000" → "3"), in the plant's `digits`. */
export function formatCount(value: string | null | undefined, digits?: DigitSystem): string {
  return formatDecimal(value ?? null, 0, digits);
}

export function findMetric(views: readonly KpiAggregateView[] | undefined, metric: string): KpiAggregateView | undefined {
  return views?.find((view) => view.metric === metric);
}

/** True when some stop time has no planned / unplanned class yet: that split is then incomplete (DT-02). */
export function hasUnknownTime(views: readonly KpiAggregateView[] | undefined): boolean {
  const value = findMetric(views, 'unknown_time')?.value;
  return value !== null && value !== undefined && /[1-9]/.test(value);
}

export interface RepairColumn {
  title: string;
  /** what the column measures, shown under the title */
  note: string;
  testId: string;
  view: (row: ReliabilityRowView) => KpiAggregateView;
}

/**
 * SME D10 / KPI08: both repair figures side by side. Mean active repair time (MTTR) is diagnosis, repair and
 * test from work-order evidence; mean time to restore production is the full outage, failure to production
 * resumed. A row without repair evidence shows the server's reason in the MTTR column, never the outage mean.
 */
export const REPAIR_COLUMNS: readonly RepairColumn[] = [
  {
    title: 'Mean active repair time (MTTR)',
    note: 'Active repair from work orders',
    testId: 'mttr-title',
    view: (row) => row.mttr,
  },
  {
    title: 'Mean time to restore production',
    note: 'Full outage, failure to production resumed',
    testId: 'restore-title',
    view: (row) => row.meanDowntimeToRestore,
  },
];
