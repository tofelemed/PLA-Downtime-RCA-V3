import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDowntimeReport } from '@/api/v2/queries/reports';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import type { DowntimeFilters } from '../model/downtime-filters';
import { DRILL_PARAM, drillParamOf, drillSelectionOf, paretoQuery, type DrillSelection } from '../model/reason-drill';

export interface DrillSelectionState {
  selection: DrillSelection | null;
  /** list a bar's stops (null closes the list); kept in the URL */
  choose: (selection: DrillSelection | null) => void;
}

/**
 * QA audit L15: the Pareto bar whose stops are listed lives in the URL (`drill=`), so opening a stop and
 * coming back restores the list. The bar is read from the same Pareto request the chart makes (one cached
 * query); a change of filters drops the choice (`useDowntimeFilters`).
 */
export function useDrillSelection(filters: DowntimeFilters, active: boolean): DrillSelectionState {
  const env = useEventHubEnv();
  const [params, setParams] = useSearchParams();
  const value = active ? params.get(DRILL_PARAM) : null;
  const report = useDowntimeReport(value ? paretoQuery(filters) : null, env.timezone);
  const data = report.data?.data;
  const selection = useMemo(
    () => drillSelectionOf(value, data, { path: filters.reasonPath, codes: env.allReasonCodes }),
    [value, data, filters.reasonPath, env.allReasonCodes],
  );
  const choose = useCallback(
    (next: DrillSelection | null) =>
      setParams((current) => {
        const updated = new URLSearchParams(current);
        if (next) updated.set(DRILL_PARAM, drillParamOf(next));
        else updated.delete(DRILL_PARAM);
        return updated;
      }),
    [setParams],
  );
  return { selection, choose };
}
