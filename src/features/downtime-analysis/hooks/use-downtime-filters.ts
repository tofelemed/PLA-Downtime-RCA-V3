import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { parseFilters, toSearchParams, type DowntimeFilters } from '../model/downtime-filters';

export interface DowntimeFiltersState {
  filters: DowntimeFilters;
  /** merges a change into the URL (shareable); reason drill resets unless the change sets it */
  change: (patch: Partial<DowntimeFilters>) => void;
}

const DRILL_KEEPING: ReadonlyArray<keyof DowntimeFilters> = ['metric', 'trendBy', 'reasonPath'];

/**
 * Filters of the Downtime Analysis page in the URL search params (plan 3.3 step 1). The default window
 * is anchored to the instant the page was opened (not re-taken on every render) and written to the URL
 * once, so a reload or a shared link shows the same window.
 */
export function useDowntimeFilters(): DowntimeFiltersState {
  const [params, setParams] = useSearchParams();
  const [openedAt] = useState(() => Date.now());
  const filters = useMemo(() => parseFilters(params, openedAt), [params, openedAt]);

  useEffect(() => {
    if (!params.get('from') || !params.get('to')) setParams(toSearchParams(filters), { replace: true });
  }, [params, filters, setParams]);

  const change = useCallback(
    (patch: Partial<DowntimeFilters>) => {
      const keepsDrill = Object.keys(patch).every((key) => DRILL_KEEPING.includes(key as keyof DowntimeFilters));
      const next = { ...filters, ...(keepsDrill ? {} : { reasonPath: [] }), ...patch };
      setParams(toSearchParams(next));
    },
    [filters, setParams],
  );

  return { filters, change };
}
