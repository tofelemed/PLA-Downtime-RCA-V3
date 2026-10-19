import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWindowClock } from '@/features/event-hub/hooks/use-window-clock';
import { hasAbsoluteWindow, hasWindowParams, parseFilters, toSearchParams, type DowntimeFilters } from '../model/downtime-filters';
import { DRILL_PARAM } from '../model/reason-drill';

export interface DowntimeFiltersState {
  filters: DowntimeFilters;
  /** merges a change into the URL (shareable); reason drill resets unless the change sets it */
  change: (patch: Partial<DowntimeFilters>) => void;
}

const FILTER_KEYS = new Set(['from', 'to', 'window', 'units', 'class', 'micro', 'approved', 'metric', 'trend', 'reasons', 'products', 'shifts', 'crews']);
/** Other params (analysis mode, …) are kept; `dropped` ones (the listed Pareto bar) are cleared by a filter change. */
const withOthers = (filters: DowntimeFilters, current: URLSearchParams, dropped: readonly string[] = []) => {
  const next = toSearchParams(filters);
  current.forEach((value, key) => { if (!FILTER_KEYS.has(key) && !dropped.includes(key)) next.set(key, value); });
  return next;
};

const DRILL_KEEPING: ReadonlyArray<keyof DowntimeFilters> = ['metric', 'trendBy', 'reasonPath'];

/**
 * Filters of the Downtime Analysis page in the URL search params (plan 3.3 step 1). A rolling window is
 * kept as its key (`window=7d`) and resolved from a clock that moves on while the page is open (A-5);
 * chosen dates stay explicit bounds. A missing window is written once as the default key.
 */
export function useDowntimeFilters(): DowntimeFiltersState {
  const [params, setParams] = useSearchParams();
  const [now, refreshWindow] = useWindowClock(!hasAbsoluteWindow(params));
  const filters = useMemo(() => parseFilters(params, now), [params, now]);

  useEffect(() => {
    if (!hasWindowParams(params)) setParams((current) => withOthers(filters, current), { replace: true });
  }, [params, filters, setParams]);

  const change = useCallback(
    (patch: Partial<DowntimeFilters>) => {
      const keepsDrill = Object.keys(patch).every((key) => DRILL_KEEPING.includes(key as keyof DowntimeFilters));
      const next = { ...filters, ...(keepsDrill ? {} : { reasonPath: [] }), ...patch };
      if (next.relativeWindow && next.relativeWindow !== filters.relativeWindow) refreshWindow();
      setParams((current) => withOthers(next, current, [DRILL_PARAM]));
    },
    [filters, setParams, refreshWindow],
  );

  return { filters, change };
}
