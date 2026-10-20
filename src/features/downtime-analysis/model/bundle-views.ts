import type { CalendarBasisView, DataCoverageView, DowntimeGroupView, KpiAggregateView } from '@/api/v2/types/reports';
import { periodSelection, reportBase, SCHEDULE_CLASSES, type DowntimeFilters, type DowntimeMetric, type PeriodSelection, type ReportBase, type ScheduleClass } from './downtime-filters';

/** One breakdown of `GET /reports/downtime-bundle` (backend `DowntimeBundleItemView`). */
export interface DowntimeBundleItem {
  view: string;
  groupBy: string;
  metric: DowntimeMetric;
  unit: 's' | 'count';
  scheduleClass: string | null;
  groups: DowntimeGroupView[];
  total: string;
}

/** `GET /reports/downtime-bundle` data: every view reads the same run selection, window and units (T24). */
export interface DowntimeBundleData {
  includeMicroStops: boolean;
  /** the schedule class the summary is for (null = every class; owner decision 2026-10-19) */
  scheduleClass?: string | null;
  summary: KpiAggregateView[];
  views: DowntimeBundleItem[];
  /** state data coverage and no-plan periods of the window (owner decision 2026-10-19) */
  dataCoverage?: DataCoverageView;
  calculationRunIds: string[];
  /** plan 2.3: units/days without a calculation run, on calendar basis (absent from older servers) */
  calendarBasis?: CalendarBasisView;
}

/** `<groupBy>[:<metric>][:<scheduleClass>]`; the class is left out for "all classes". */
export function viewToken(groupBy: string, metric: DowntimeMetric, scheduleClass?: string | null): string {
  return scheduleClass && scheduleClass !== 'all' ? `${groupBy}:${metric}:${scheduleClass}` : `${groupBy}:${metric}`;
}

/** The trend's schedule classes: all four, or only the class the page is filtered to. */
export function trendClasses(filters: DowntimeFilters): readonly ScheduleClass[] {
  return SCHEDULE_CLASSES.filter((scheduleClass) => filters.scheduleClass === 'all' || filters.scheduleClass === scheduleClass);
}

/** Tokens of the widgets that share the page snapshot: bad actors (2), crews, one trend series per class. */
export function pageViews(filters: DowntimeFilters) {
  const assetDuration = viewToken('asset', 'duration', filters.scheduleClass);
  const assetFrequency = viewToken('asset', 'frequency', filters.scheduleClass);
  const crew = viewToken('crew', filters.metric, filters.scheduleClass);
  const trend = Object.fromEntries(trendClasses(filters).map((scheduleClass) => [scheduleClass, viewToken(filters.trendBy, filters.metric, scheduleClass)])) as Partial<Record<ScheduleClass, string>>;
  return { assetDuration, assetFrequency, crew, trend };
}

export type PageViews = ReturnType<typeof pageViews>;

export interface DowntimeBundleQuery extends ReportBase, PeriodSelection {
  /** at least one token: the API refuses an empty list (422) */
  views: string[];
  includeMicroStops?: boolean;
  /** the summary follows the page's schedule class (owner decision 2026-10-19); left out for every class */
  scheduleClass?: ScheduleClass;
}

/** The one bundle request of the page (views sorted so equal pages share a cache key). */
export function bundleQuery(filters: DowntimeFilters): DowntimeBundleQuery {
  const views = pageViews(filters);
  const tokens = [views.assetDuration, views.assetFrequency, views.crew, ...Object.values(views.trend)].filter((token): token is string => Boolean(token));
  const query: DowntimeBundleQuery = { ...reportBase(filters), ...periodSelection(filters), views: [...new Set(tokens)].sort() };
  if (filters.includeMicroStops) query.includeMicroStops = true;
  if (filters.scheduleClass !== 'all') query.scheduleClass = filters.scheduleClass;
  return query;
}

/** The breakdown of one token, if the bundle has it. */
export function viewOf(data: DowntimeBundleData | undefined, token: string | undefined): DowntimeBundleItem | undefined {
  return token ? data?.views.find((view) => view.view === token) : undefined;
}

/**
 * Request only the breakdowns rendered by the active page; the server always includes its summary. A page
 * that shows the summary only (the previous-period comparison) still names one view — the trend series it
 * would show — because the API requires at least one (QA audit F1: an empty list was refused with 422).
 */
export function pageBundleQuery(filters: DowntimeFilters, page: string, mode: string | null): DowntimeBundleQuery {
  const views = pageViews(filters);
  const trend = Object.values(views.trend).filter((token): token is string => Boolean(token));
  const tokens = page === 'causes' ? [views.assetDuration, views.assetFrequency] : page === 'trends' && mode === 'crew' ? [views.crew] : trend;
  return { ...bundleQuery(filters), views: [...new Set(tokens)].sort() };
}
