import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DAY_MS, rollingWindow } from '@/api/v2/queries/time-window';
import type { InstantRange } from '@/features/ux-kit/date-inputs';
import { MAX_TREND_SIGNALS } from './historian-model';

export interface HistorianParams {
  signalIds: string[];
  range: InstantRange;
  setSignalIds: (ids: readonly string[]) => void;
  setRange: (range: InstantRange) => void;
}

const ISO = /^\d{4}-\d{2}-\d{2}T/;

/**
 * The trend in the URL (`?signal=…&signal=…&from=…&to=…`), so a trend can be bookmarked and shared; the
 * period defaults to the last 24 hours (minute-stable, so the cache is hit on revisits).
 */
export function useHistorianParams(): HistorianParams {
  const [params, setParams] = useSearchParams();
  const signalKey = params.getAll('signal').join('|');
  const from = params.get('from');
  const to = params.get('to');
  const signalIds = useMemo(() => (signalKey ? signalKey.split('|').slice(0, MAX_TREND_SIGNALS) : []), [signalKey]);
  const range = useMemo<InstantRange>(() => (from && to && ISO.test(from) && ISO.test(to) ? { from, to } : rollingWindow(DAY_MS)), [from, to]);
  const setSignalIds = useCallback(
    (ids: readonly string[]) =>
      setParams((current) => {
        const copy = new URLSearchParams(current);
        copy.delete('signal');
        for (const id of ids.slice(0, MAX_TREND_SIGNALS)) copy.append('signal', id);
        return copy;
      }),
    [setParams],
  );
  const setRange = useCallback(
    (next: InstantRange) =>
      setParams(
        (current) => {
          const copy = new URLSearchParams(current);
          if (next.from) copy.set('from', next.from);
          if (next.to) copy.set('to', next.to);
          return copy;
        },
        { replace: true },
      ),
    [setParams],
  );
  return { signalIds, range, setSignalIds, setRange };
}
