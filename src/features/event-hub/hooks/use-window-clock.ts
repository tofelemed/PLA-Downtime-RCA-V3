import { useCallback, useEffect, useState } from 'react';
import { RELATIVE_WINDOW_REFRESH_MS } from '../model/relative-window';

/**
 * The instant a rolling window is resolved at (A-5). While `active`, it moves on every `intervalMs` and
 * when the tab becomes visible again; `refresh` re-takes it now (e.g. when the user picks a preset).
 * Never re-taken during render.
 */
export function useWindowClock(active: boolean, intervalMs: number = RELATIVE_WINDOW_REFRESH_MS): readonly [number, () => void] {
  const [now, setNow] = useState(() => Date.now());
  const refresh = useCallback(() => setNow(Date.now()), []);
  useEffect(() => {
    if (!active) return undefined;
    const timer = window.setInterval(refresh, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [active, intervalMs, refresh]);
  return [now, refresh] as const;
}
