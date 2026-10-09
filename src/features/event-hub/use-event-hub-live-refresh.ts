import { useEffect, useRef } from 'react';
import { useFlag } from '@/api/v2/queries/feature-flags';
import { realtimeBus } from '@/realtime/realtime-bus';
import { productionEventsWebSocket } from '@/services/api/productionEventsWebSocket';

const V1_EVENTS = ['productionEventCreated', 'productionEventUpdated', 'productionEventDeleted'];

/** Trailing debounce: a burst of notices (bulk coding, replays) causes one refresh. */
export const LIVE_REFRESH_DEBOUNCE_MS = 500;

/**
 * Live refresh of the Event Hub list (plan 3.1 step 3). With the `v2.eventHub` flag on it follows the
 * authenticated, tenant/unit-scoped channel (production-event notices and resyncs); otherwise the v1
 * broadcast as before (decision C4). `scopeKey` reconnects the listener when user or tenant change.
 */
export function useEventHubLiveRefresh(active: boolean, refresh: () => void, scopeKey: string): void {
  const flag = useFlag('v2.eventHub');
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!active || flag.loading) return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => refreshRef.current(), LIVE_REFRESH_DEBOUNCE_MS);
    };
    const unsubscribe = flag.enabled
      ? realtimeBus.subscribe((signal) => {
          if (signal.kind === 'resync' || signal.notice.entityType === 'production_event') schedule();
        })
      : subscribeV1(schedule);
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [active, flag.enabled, flag.loading, scopeKey]);
}

function subscribeV1(onChange: () => void): () => void {
  productionEventsWebSocket.connect();
  const offs = V1_EVENTS.map((name) => productionEventsWebSocket.on(name, onChange));
  return () => offs.forEach((off) => off());
}
