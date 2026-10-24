import type { DowntimeGroupView } from '@/api/v2/types/reports';
import type { TrendGroup } from '@/api/v2/types/pla-analytics';
import { viewToken, viewOf, type DowntimeBundleData } from '@/features/downtime-analysis/model/bundle-views';
import type { ScheduleClass } from '@/features/downtime-analysis/model/downtime-filters';

export const TREND_CLASSES: readonly ScheduleClass[] = ['planned', 'unplanned', 'external', 'unknown'];
export const PARETO_SIZE = 5;

/** One step of the trend: the server's duration of each schedule class and stop count, joined by the step's key (placed, never added). */
export interface DowntimeStep {
  key: string;
  label: string;
  durations: Partial<Record<ScheduleClass, string>>;
  stops: string | null;
}

const stopsView = (trendBy: TrendGroup) => viewToken(trendBy, 'frequency');
const classView = (trendBy: TrendGroup, scheduleClass: ScheduleClass) => viewToken(trendBy, 'duration', scheduleClass);
export const paretoView = () => viewToken('reason', 'duration', 'unplanned');
export const assetDurationView = () => viewToken('asset', 'duration');
export const assetStopsView = () => viewToken('asset', 'frequency');

/** The breakdowns of the one bundle request; the asset views only when an asset is selected. */
export function seriesViews(trendBy: TrendGroup, assetSelected: boolean): string[] {
  const views = [...TREND_CLASSES.map((scheduleClass) => classView(trendBy, scheduleClass)), stopsView(trendBy), paretoView()];
  return assetSelected ? [...views, assetDurationView(), assetStopsView()] : views;
}

/** The trend steps in chronological order of their server keys; labels come from `labelOf`. */
export function downtimeSteps(data: DowntimeBundleData | undefined, trendBy: TrendGroup, labelOf: (key: string) => string): DowntimeStep[] {
  const steps = new Map<string, DowntimeStep>();
  const step = (key: string) => {
    const existing = steps.get(key) ?? { key, label: labelOf(key), durations: {}, stops: null };
    steps.set(key, existing);
    return existing;
  };
  for (const scheduleClass of TREND_CLASSES) {
    for (const group of viewOf(data, classView(trendBy, scheduleClass))?.groups ?? []) {
      if (group.key !== null) step(group.key).durations[scheduleClass] = group.value;
    }
  }
  for (const group of viewOf(data, stopsView(trendBy))?.groups ?? []) {
    if (group.key !== null) step(group.key).stops = group.value;
  }
  return [...steps.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** The server's top unplanned reasons, largest first. */
export function paretoGroups(data: DowntimeBundleData | undefined): DowntimeGroupView[] {
  return (viewOf(data, paretoView())?.groups ?? []).slice(0, PARETO_SIZE);
}

export interface AssetFigures {
  duration: DowntimeGroupView | undefined;
  stops: DowntimeGroupView | undefined;
}

/** The selected asset's own rows of the per-asset breakdowns (selection by key). */
export function assetFigures(data: DowntimeBundleData | undefined, assetId: string): AssetFigures {
  const row = (token: string) => viewOf(data, token)?.groups.find((group) => group.key === assetId);
  return { duration: row(assetDurationView()), stops: row(assetStopsView()) };
}

/** True when a server decimal string is not zero (a comparison, not arithmetic). */
export const isNonZero = (value: string | null | undefined): boolean => value !== null && value !== undefined && /[1-9]/.test(value);

/** The schedule classes the legend lists: planned and unplanned always, external and unknown only when some step has a value. */
export function shownClasses(steps: readonly DowntimeStep[]): ScheduleClass[] {
  return TREND_CLASSES.filter((scheduleClass) => scheduleClass === 'planned' || scheduleClass === 'unplanned' || steps.some((step) => isNonZero(step.durations[scheduleClass])));
}
