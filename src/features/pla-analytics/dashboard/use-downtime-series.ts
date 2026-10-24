import { useMemo } from 'react';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { useDowntimeBundle } from '@/features/downtime-analysis/hooks/use-downtime-bundle';
import { useCalendarPreference } from '@/lib/dates';
import { bucketLabel } from '../model/buckets';
import { scopeBase, type AnalyticsScope } from '../model/analytics-scope';
import { assetFigures, downtimeSteps, paretoGroups, seriesViews } from './downtime-series-model';

/** Everything the Downtime section shows, from ONE `/reports/downtime-bundle` call: the summary, per-step class durations and stops, the unplanned reasons and (with an asset) its own rows. */
export function useDowntimeSeries(scope: AnalyticsScope, assetId?: string) {
  const env = useEventHubEnv();
  const pref = useCalendarPreference();
  const query = useDowntimeBundle({ ...scopeBase(scope), views: seriesViews(scope.trendBy, Boolean(assetId)) }, env.timezone);
  const data = query.data?.data;
  const steps = useMemo(() => downtimeSteps(data, scope.trendBy, (key) => bucketLabel(key, scope.trendBy, pref)), [data, scope.trendBy, pref]);
  return {
    query,
    summary: data?.summary,
    steps,
    pareto: paretoGroups(data),
    asset: assetId ? assetFigures(data, assetId) : null,
  };
}
