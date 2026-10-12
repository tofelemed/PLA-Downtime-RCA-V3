import { useSyncExternalStore } from 'react';

/** Connection state of the scoped realtime channel, shown by the header's live indicator. */
export type RealtimeStatus = 'idle' | 'connecting' | 'live' | 'offline';

let current: RealtimeStatus = 'idle';
const listeners = new Set<() => void>();

/** Set by `useScopedRealtime` on connect / disconnect; screens only read it. */
export function setRealtimeStatus(next: RealtimeStatus): void {
  if (next === current) return;
  current = next;
  for (const listener of listeners) listener();
}

export function getRealtimeStatus(): RealtimeStatus {
  return current;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The live connection state (re-renders only the components that read it). */
export function useRealtimeStatus(): RealtimeStatus {
  return useSyncExternalStore(subscribe, getRealtimeStatus, getRealtimeStatus);
}
