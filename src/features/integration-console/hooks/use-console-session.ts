import { useCallback, useMemo, useState } from 'react';
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

/**
 * What this browser session learned about each connection that the server does not store: the last
 * diagnostics result and when source records were sampled (plan 3.7 stage tracker). Memory only — no
 * browser storage; a reload starts over, the server-backed stages stay.
 */
export function useConsoleSession(): ConsoleSession {
  const [tests, setTests] = useState<Record<string, SessionTest>>({});
  const [samples, setSamples] = useState<Record<string, string>>({});
  const recordTest = useCallback((connectionId: string, result: ConnectionTestView) => {
    setTests((current) => ({ ...current, [connectionId]: { result, at: new Date().toISOString() } }));
  }, []);
  const recordSample = useCallback((connectionId: string) => {
    setSamples((current) => ({ ...current, [connectionId]: new Date().toISOString() }));
  }, []);
  return useMemo(
    () => ({
      testOf: (connectionId: string) => tests[connectionId] ?? null,
      recordTest,
      sampledAt: (connectionId: string) => samples[connectionId] ?? null,
      recordSample,
    }),
    [tests, samples, recordTest, recordSample],
  );
}
