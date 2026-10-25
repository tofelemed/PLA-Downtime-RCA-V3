import type { DowntimeReportQuery } from '@/api/v2/queries/reports';
import { relativeWindowOf, resolveRelativeWindow, type RelativeWindowKey } from '@/features/event-hub/model/relative-window';

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


/**
 * Rolling window presets (keys shared with the Event Hub, A-5): kept relative in the URL (`window=7d`)
 * and resolved from now whenever the page fetches; never resolved during render.
 */
export const WINDOW_PRESETS = [
  { key: '24h', label: 'Last 24 h', hours: 24 },
  { key: '7d', label: 'Last 7 days', hours: 24 * 7 },
  { key: '30d', label: 'Last 30 days', hours: 24 * 30 },
  { key: '90d', label: 'Last 90 days', hours: 24 * 90 },
] as const;
export const DEFAULT_PRESET = WINDOW_PRESETS[2];

/** Everything the page is filtered by; it lives in the URL so a view can be shared (plan 3.3 step 1). */
export interface DowntimeFilters {
  unitIds: string[];
  /** UTC window [from, to) — periods starting in it */
  from: string;
  to: string;
  windowLabel: string;
  /** A-5: a rolling window (bounds resolved from now); null = explicit bounds */
  relativeWindow: RelativeWindowKey | null;
  scheduleClass: ScheduleFilter;
  includeMicroStops: boolean;
  approvedOnly: boolean;
  metric: DowntimeMetric;
  trendBy: TrendGroup;
  /** reason drill path from the root (ids); empty = level 1 */
  reasonPath: string[];
  /** period selection applied by the server (downtime summary and breakdowns): empty = every period */
  productIds: string[];
  shiftNames: string[];
  crewIds: string[];
}

/** A preset window ending `now`, with minute-stable bounds so a revisit hits the cached reports. */
export function presetWindow(hours: number, now: number): { from: string; to: string } {
  return resolveRelativeWindow({ hours }, now);
}

const oneOf = <T extends string>(values: readonly T[], value: string | null, fallback: T): T =>
  value !== null && (values as readonly string[]).includes(value) ? (value as T) : fallback;

const isInstant = (value: string | null): value is string => value !== null && !Number.isNaN(Date.parse(value));

const list = (value: string | null) => (value ? value.split(',').filter(Boolean) : []);

/** True when the URL holds explicit bounds (chosen dates, or a link written before A-5). */
export function hasAbsoluteWindow(params: URLSearchParams): boolean {
  const from = params.get('from');
  const to = params.get('to');
  return isInstant(from) && isInstant(to) && Date.parse(from) < Date.parse(to);
}

/** True when the URL names its window (explicit bounds or a rolling key); otherwise the default applies. */
export const hasWindowParams = (params: URLSearchParams) => hasAbsoluteWindow(params) || relativeWindowOf(params.get('window')) !== null;

function windowOf(params: URLSearchParams, now: number): Pick<DowntimeFilters, 'from' | 'to' | 'windowLabel' | 'relativeWindow'> {
  const name = params.get('window');
  if (hasAbsoluteWindow(params)) {
    return { from: params.get('from') ?? '', to: params.get('to') ?? '', windowLabel: relativeWindowOf(name)?.label ?? name ?? 'Custom window', relativeWindow: null };
  }
  const relative = relativeWindowOf(name) ?? DEFAULT_PRESET;
  return { ...presetWindow(relative.hours, now), windowLabel: relative.label, relativeWindow: relative.key };
}

/** Filters from the URL; a rolling or missing window (the default preset) is resolved at `now`. */
export function parseFilters(params: URLSearchParams, now: number): DowntimeFilters {
  return {
    unitIds: list(params.get('units')).sort(),
    ...windowOf(params, now),
    scheduleClass: oneOf(SCHEDULE_FILTERS, params.get('class'), 'all'),
    includeMicroStops: params.get('micro') === '1',
    approvedOnly: params.get('approved') === '1',
    metric: oneOf(['duration', 'frequency'] as const, params.get('metric'), 'duration'),
    trendBy: oneOf(TREND_GROUPS, params.get('trend'), 'day'),
    reasonPath: list(params.get('reasons')),
    productIds: list(params.get('products')).sort(),
    shiftNames: list(params.get('shifts')).sort(),
    crewIds: list(params.get('crews')).sort(),
  };
}

/** The URL form of the filters (a rolling window as its key only; defaults left out, so equal filters give equal URLs). */
export function toSearchParams(filters: DowntimeFilters): URLSearchParams {
  const params = filters.relativeWindow
    ? new URLSearchParams({ window: filters.relativeWindow })
    : new URLSearchParams({ from: filters.from, to: filters.to, window: filters.windowLabel });
  if (filters.unitIds.length > 0) params.set('units', [...filters.unitIds].sort().join(','));
  if (filters.scheduleClass !== 'all') params.set('class', filters.scheduleClass);
  if (filters.includeMicroStops) params.set('micro', '1');
  if (filters.approvedOnly) params.set('approved', '1');
  if (filters.metric !== 'duration') params.set('metric', filters.metric);
  if (filters.trendBy !== 'day') params.set('trend', filters.trendBy);
  if (filters.reasonPath.length > 0) params.set('reasons', filters.reasonPath.join(','));
  if (filters.productIds.length > 0) params.set('products', [...filters.productIds].sort().join(','));
  if (filters.shiftNames.length > 0) params.set('shifts', [...filters.shiftNames].sort().join(','));
  if (filters.crewIds.length > 0) params.set('crews', [...filters.crewIds].sort().join(','));
  return params;
}

/** The product, shift and crew selection of the downtime reports (only the lists that are set). */
export interface PeriodSelection {
  productIds?: string[];
  shiftNames?: string[];
  crewIds?: string[];
}

export function periodSelection(filters: DowntimeFilters): PeriodSelection {
  const selection: PeriodSelection = {};
  if (filters.productIds.length > 0) selection.productIds = [...filters.productIds].sort();
  if (filters.shiftNames.length > 0) selection.shiftNames = [...filters.shiftNames].sort();
  if (filters.crewIds.length > 0) selection.crewIds = [...filters.crewIds].sort();
  return selection;
}

/** true when a product, shift or crew filter narrows the downtime reports. */
export const hasPeriodSelection = (filters: DowntimeFilters) => Object.keys(periodSelection(filters)).length > 0;

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

export type DowntimeQuery = DowntimeReportQuery & ReportBase & PeriodSelection;

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
  const query: DowntimeQuery = { ...reportBase(filters), ...periodSelection(filters), groupBy };
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
  return { ...filters, from, to: filters.from, windowLabel: `Previous ${filters.windowLabel.toLowerCase()}`, relativeWindow: null };
}
