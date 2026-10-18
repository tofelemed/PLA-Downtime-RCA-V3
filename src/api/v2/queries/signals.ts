import { useEffect } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import type { BodyOf } from '../schema-types';
import type { JobAccepted } from '../types/envelopes';
import type { SignalBackfillView, SignalPreviewView, SignalView } from '../types/integration-mappings';
import { v2 } from '../v2';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { usePagedQuery } from './use-paged-query';
import { useV2Command } from './use-v2-command';
import { flattenPages, useV2InfiniteList } from './use-v2-list';
import { useV2TenantId } from './use-v2-tenant';

export type SignalCreateBody = BodyOf<'/api/v2/signals', 'post'>;

export interface SignalWindow {
  signalId: string;
  from: string;
  to: string;
}

const RUN_POLL_MS = 3_000;

/** Typed measurement signals of a connection, every version (plan 1.7), pages of 20. */
export function useSignalsPage(connectionId: string) {
  return usePagedQuery<SignalView>({
    resource: 'signals',
    path: '/signals',
    query: { connectionId },
    key: { filters: { connectionId } },
  });
}

/** Every signal of the tenant (lookup for the historian picker); later pages are followed. */
export function useSignalCatalog() {
  const list = useV2InfiniteList<SignalView>({
    resource: 'signals',
    path: '/signals',
    query: { limit: 200 },
    key: { filters: { catalog: true } },
  });
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  return { ...list, items: flattenPages(list.data?.pages) };
}

const samplesQuery = (tenantId: string | null, window: SignalWindow) => ({
  queryKey: v2Keys.detail(tenantId ?? '-', 'signals', window.signalId, `samples|${window.from}|${window.to}`),
  enabled: Boolean(tenantId),
  staleTime: STALE_TIME.signals,
  queryFn: async ({ signal }: { signal: AbortSignal }) =>
    (await v2.post<SignalPreviewView, '/api/v2/signals/{id}/preview'>('/api/v2/signals/{id}/preview', {
      path: { id: window.signalId },
      body: { from: window.from, to: window.to },
      idempotencyKey: `samples-${window.signalId}-${window.from}-${window.to}`,
      signal,
    })).data,
});

/**
 * Stored samples of signals in `[from, to)` (≤ 31 days, ≤ 50 000 samples each) through the read-only
 * preview command, one query per signal; nothing is stored.
 */
export function useSignalSamples(windows: readonly SignalWindow[]) {
  const tenantId = useV2TenantId();
  return useQueries({ queries: windows.map((window) => samplesQuery(tenantId, window)) });
}

/** Creates a signal, or the next version of the signal with the same source key (422 RATE_TIMEBASE_REQUIRED). */
export function useCreateSignal() {
  const tenantId = useV2TenantId();
  return useV2Command<SignalCreateBody, SignalView>({
    run: async ({ input, idempotencyKey }) => (await v2.post<SignalView, '/api/v2/signals'>('/api/v2/signals', { body: input, idempotencyKey })).data,
    changes: () => (tenantId ? { tenantId, entityType: 'signal' } : null),
  });
}

/** Quantity preview of a window (read-only POST; the server computes quantity and coverage). */
export function useSignalPreview() {
  return useV2Command<SignalWindow, SignalPreviewView>({
    run: async ({ input, idempotencyKey }) =>
      (await v2.post<SignalPreviewView, '/api/v2/signals/{id}/preview'>('/api/v2/signals/{id}/preview', {
        path: { id: input.signalId },
        body: { from: input.from, to: input.to },
        idempotencyKey,
      })).data,
    changes: () => null,
  });
}

/** Re-reads `[from, to)` from the source (≤ 90 days, ending by now): 202 + run. */
export function useSignalBackfill() {
  const tenantId = useV2TenantId();
  return useV2Command<SignalWindow, JobAccepted>({
    run: async ({ input, idempotencyKey }) =>
      (await v2.post<JobAccepted, '/api/v2/signals/{id}/backfill'>('/api/v2/signals/{id}/backfill', {
        path: { id: input.signalId },
        body: { from: input.from, to: input.to },
        idempotencyKey,
      })).data,
    changes: () => (tenantId ? { tenantId, entityType: 'ingestion_job' } : null),
  });
}

/** Backfill run state, polled until it completes or fails. */
export function useSignalBackfillRun(signalId: string, runId: string | null) {
  const tenantId = useV2TenantId();
  return useQuery<SignalBackfillView>({
    queryKey: v2Keys.detail(tenantId ?? '-', 'signals', signalId, `backfill-${runId ?? '-'}`),
    enabled: Boolean(tenantId && runId),
    staleTime: STALE_TIME['replay-runs'],
    refetchInterval: (query) => (query.state.data?.state === 'completed' || query.state.data?.state === 'failed' ? false : RUN_POLL_MS),
    queryFn: async ({ signal }) =>
      (await v2.get<SignalBackfillView, '/api/v2/signals/{id}/backfills/{runId}'>('/api/v2/signals/{id}/backfills/{runId}', {
        path: { id: signalId, runId: runId as string },
        signal,
      })).data,
  });
}

/** Signal names of one unit (id → name) for provenance labels; every page followed. */
export function useUnitSignalNames(unitId: string | null) {
  const list = useV2InfiniteList<SignalView>({
    resource: 'signals',
    path: '/signals',
    query: { unitId: unitId ?? '', limit: 200 },
    key: { scope: { unitIds: unitId ? [unitId] : [] }, filters: { names: true } },
    enabled: Boolean(unitId),
  });
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const names = new Map(flattenPages(list.data?.pages).map((s) => [s.id, s.name]));
  return (signalId: string): string | null => names.get(signalId) ?? null;
}
