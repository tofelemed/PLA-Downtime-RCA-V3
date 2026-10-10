import { useQuery } from '@tanstack/react-query';
import type { JobAccepted } from '../types/envelopes';
import type { SignalBackfillView, SignalPreviewView, SignalView } from '../types/integration-mappings';
import { v2 } from '../v2';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { useV2Command } from './use-v2-command';
import { flattenPages, useV2InfiniteList } from './use-v2-list';
import { useV2TenantId } from './use-v2-tenant';

export interface SignalWindow {
  signalId: string;
  from: string;
  to: string;
}

const RUN_POLL_MS = 3_000;

/** Typed measurement signals of a connection, every version (plan 1.7). */
export function useSignals(connectionId: string) {
  const list = useV2InfiniteList<SignalView>({
    resource: 'signals',
    path: '/signals',
    query: { connectionId, limit: 200 },
    key: { filters: { connectionId } },
  });
  return { ...list, items: flattenPages(list.data?.pages) };
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
