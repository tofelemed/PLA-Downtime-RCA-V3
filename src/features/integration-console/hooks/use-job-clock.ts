import { useEffect, useState } from 'react';
import { jobPollInterval } from '@/api/v2/queries/ingestion-jobs';

/**
 * Wall clock for job ages (display only). It ticks with the job poll while a job runs or drains and the
 * tab is visible; with nothing running it stands still, like the poll itself.
 */
export function useJobClock(states: ReadonlyArray<string | null | undefined>): number {
  const [now, setNow] = useState(() => Date.now());
  const interval = jobPollInterval(states);
  useEffect(() => {
    if (interval === false) return undefined;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') setNow(Date.now());
    }, interval);
    return () => window.clearInterval(timer);
  }, [interval]);
  return now;
}
