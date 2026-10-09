import type { RealtimeNotice } from './realtime-types';

export type RealtimeSignal =
  | { kind: 'notice'; notice: RealtimeNotice }
  /** messages may have been missed: anything derived from the channel must be refetched */
  | { kind: 'resync'; rooms: string[] };

type Listener = (signal: RealtimeSignal) => void;

const listeners = new Set<Listener>();

/**
 * In-page fan-out of the scoped realtime channel (after dedupe and cache invalidation) for screens that
 * react beyond TanStack Query, e.g. the v1 Event Hub list refetch behind the `v2.eventHub` flag.
 */
export const realtimeBus = {
  publish(signal: RealtimeSignal): void {
    for (const listener of listeners) listener(signal);
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
