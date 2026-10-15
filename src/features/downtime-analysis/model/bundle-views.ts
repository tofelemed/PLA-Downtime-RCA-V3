import type { DowntimeGroupView, KpiAggregateView } from '@/api/v2/types/reports';
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
  summary: KpiAggregateView[];
  views: DowntimeBundleItem[];
  calculationRunIds: string[];
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
  views: string[];
  includeMicroStops?: boolean;
}

/** The one bundle request of the page (views sorted so equal pages share a cache key). */
export function bundleQuery(filters: DowntimeFilters): DowntimeBundleQuery {
  const views = pageViews(filters);
  const tokens = [views.assetDuration, views.assetFrequency, views.crew, ...Object.values(views.trend)].filter((token): token is string => Boolean(token));
  const query: DowntimeBundleQuery = { ...reportBase(filters), ...periodSelection(filters), views: [...new Set(tokens)].sort() };
  if (filters.includeMicroStops) query.includeMicroStops = true;
  return query;
}

/** The breakdown of one token, if the bundle has it. */
export function viewOf(data: DowntimeBundleData | undefined, token: string | undefined): DowntimeBundleItem | undefined {
  return token ? data?.views.find((view) => view.view === token) : undefined;
}
