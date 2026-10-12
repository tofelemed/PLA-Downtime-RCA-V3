import { useMemo, useSyncExternalStore } from 'react';
import type { ConnectionTestView } from '@/api/v2/types/integrations';

export interface SessionTest {
  result: ConnectionTestView;
  at: string;
}

export interface ConsoleSession {
  testOf: (connectionId: string) => SessionTest | null;
  recordTest: (connectionId: string, result: ConnectionTestView) => void;
  sampledAt: (connectionId: string) => string | null;
  recordSample: (connectionId: string) => void;
}

interface SessionState {
  tests: Readonly<Record<string, SessionTest>>;
  samples: Readonly<Record<string, string>>;
}

let state: SessionState = { tests: {}, samples: {} };
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => state;
const update = (next: SessionState) => {
  state = next;
  for (const listener of listeners) listener();
};

function recordTest(connectionId: string, result: ConnectionTestView): void {
  update({ ...state, tests: { ...state.tests, [connectionId]: { result, at: new Date().toISOString() } } });
}

function recordSample(connectionId: string): void {
  update({ ...state, samples: { ...state.samples, [connectionId]: new Date().toISOString() } });
}

/** Test seam: forget what this browser session learned. */
export function resetConsoleSession(): void {
  update({ tests: {}, samples: {} });
}

/**
 * What this browser session learned about each connection that the server does not store: the last
 * diagnostics result and when source records were sampled (stage tracker). Memory only, shared by the
 * console's pages (list, detail, editor) so it survives moving between them; a reload starts over and
 * connection ids are tenant-unique, so a plant switch never mixes results.
 */
export function useConsoleSession(): ConsoleSession {
  const current = useSyncExternalStore(subscribe, snapshot, snapshot);
  return useMemo(
    () => ({
      testOf: (connectionId: string) => current.tests[connectionId] ?? null,
      recordTest,
      sampledAt: (connectionId: string) => current.samples[connectionId] ?? null,
      recordSample,
    }),
    [current],
  );
}
