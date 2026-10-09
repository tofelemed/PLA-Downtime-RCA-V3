import type { DowntimeReportQuery } from '@/api/v2/queries/reports';

/** Schedule class filter of the report (`all` = parameter left out). */
export const SCHEDULE_FILTERS = ['all', 'planned', 'unplanned', 'external', 'unknown'] as const;
export type ScheduleFilter = (typeof SCHEDULE_FILTERS)[number];
export type ScheduleClass = Exclude<ScheduleFilter, 'all'>;
export const SCHEDULE_CLASSES: readonly ScheduleClass[] = ['planned', 'unplanned', 'external', 'unknown'];

/** Site-local trend groupings of the report (AN03). */
export const TREND_GROUPS = ['shift', 'day', 'week', 'month'] as const;
export type TrendGroup = (typeof TREND_GROUPS)[number];

export type DowntimeMetric = 'duration' | 'frequency';
export type DowntimeGroupBy = NonNullable<DowntimeReportQuery['groupBy']>;

const HOUR_MS = 3_600_000;

/** Window presets ending now; the instant is taken when a preset is chosen, never during render. */
export const WINDOW_PRESETS = [
  { key: '24h', label: 'Last 24 h', hours: 24 },
  { key: '7d', label: 'Last 7 days', hours: 24 * 7 },
  { key: '30d', label: 'Last 30 days', hours: 24 * 30 },
  { key: '90d', label: 'Last 90 days', hours: 24 * 90 },
] as const;
export const DEFAULT_PRESET = WINDOW_PRESETS[1];

/** Everything the page is filtered by; it lives in the URL so a view can be shared (plan 3.3 step 1). */
export interface DowntimeFilters {
  unitIds: string[];
  /** UTC window [from, to) — periods starting in it */
  from: string;
  to: string;
  windowLabel: string;
  scheduleClass: ScheduleFilter;
  includeMicroStops: boolean;
  approvedOnly: boolean;
  metric: DowntimeMetric;
  trendBy: TrendGroup;
  /** reason drill path from the root (ids); empty = level 1 */
  reasonPath: string[];
}

export function presetWindow(hours: number, now: number): { from: string; to: string } {
  return { from: new Date(now - hours * HOUR_MS).toISOString(), to: new Date(now).toISOString() };
}

const oneOf = <T extends string>(values: readonly T[], value: string | null, fallback: T): T =>
  value !== null && (values as readonly string[]).includes(value) ? (value as T) : fallback;

const isInstant = (value: string | null): value is string => value !== null && !Number.isNaN(Date.parse(value));

const list = (value: string | null) => (value ? value.split(',').filter(Boolean) : []);

/** Filters from the URL; a missing or broken window falls back to the default preset ending `now`. */
export function parseFilters(params: URLSearchParams, now: number): DowntimeFilters {
  const from = params.get('from');
  const to = params.get('to');
  const hasWindow = isInstant(from) && isInstant(to) && Date.parse(from) < Date.parse(to);
  const window = hasWindow ? { from, to } : presetWindow(DEFAULT_PRESET.hours, now);
  return {
    unitIds: list(params.get('units')).sort(),
    ...window,
    windowLabel: hasWindow ? params.get('window') ?? 'Custom window' : DEFAULT_PRESET.label,
    scheduleClass: oneOf(SCHEDULE_FILTERS, params.get('class'), 'all'),
    includeMicroStops: params.get('micro') === '1',
    approvedOnly: params.get('approved') === '1',
    metric: oneOf(['duration', 'frequency'] as const, params.get('metric'), 'duration'),
    trendBy: oneOf(TREND_GROUPS, params.get('trend'), 'day'),
    reasonPath: list(params.get('reasons')),
  };
}

/** The URL form of the filters (defaults left out, so equal filters give equal URLs). */
export function toSearchParams(filters: DowntimeFilters): URLSearchParams {
  const params = new URLSearchParams({ from: filters.from, to: filters.to, window: filters.windowLabel });
  if (filters.unitIds.length > 0) params.set('units', [...filters.unitIds].sort().join(','));
  if (filters.scheduleClass !== 'all') params.set('class', filters.scheduleClass);
  if (filters.includeMicroStops) params.set('micro', '1');
  if (filters.approvedOnly) params.set('approved', '1');
  if (filters.metric !== 'duration') params.set('metric', filters.metric);
  if (filters.trendBy !== 'day') params.set('trend', filters.trendBy);
  if (filters.reasonPath.length > 0) params.set('reasons', filters.reasonPath.join(','));
  return params;
}

/** The window, units and run selection every report of the page shares (T24: one snapshot). */
export interface ReportBase {
  from: string;
  to: string;
  unitIds?: string[];
  approvedOnly?: boolean;
}

export function reportBase(filters: DowntimeFilters): ReportBase {
  const base: ReportBase = { from: filters.from, to: filters.to };
  if (filters.unitIds.length > 0) base.unitIds = [...filters.unitIds].sort();
  if (filters.approvedOnly) base.approvedOnly = true;
  return base;
}

export type DowntimeQuery = DowntimeReportQuery & ReportBase;

export interface DowntimeQueryOptions {
  metric?: DowntimeMetric;
  scheduleClass?: ScheduleFilter;
  parentReasonId?: string;
}

/**
 * A `GET /reports/downtime` request of the page: the shared base plus a grouping; the page's schedule
 * class, metric and micro-stop choice unless a widget overrides them. Unset options are left out.
 */
export function downtimeQuery(filters: DowntimeFilters, groupBy: DowntimeGroupBy, options: DowntimeQueryOptions = {}): DowntimeQuery {
  const query: DowntimeQuery = { ...reportBase(filters), groupBy };
  const metric = options.metric ?? filters.metric;
  const scheduleClass = options.scheduleClass ?? filters.scheduleClass;
  if (metric !== 'duration') query.metric = metric;
  if (scheduleClass !== 'all') query.scheduleClass = scheduleClass;
  if (filters.includeMicroStops) query.includeMicroStops = true;
  if (options.parentReasonId) query.parentReasonId = options.parentReasonId;
  return query;
}

/** The window of the same length right before the chosen one (calendar comparison). */
export function previousWindow(filters: DowntimeFilters): DowntimeFilters {
  const length = Date.parse(filters.to) - Date.parse(filters.from);
  const from = new Date(Date.parse(filters.from) - length).toISOString();
  return { ...filters, from, to: filters.from, windowLabel: `Previous ${filters.windowLabel.toLowerCase()}` };
}
