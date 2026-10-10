import { useQuery } from '@tanstack/react-query';
import type { BodyOf, QueryOf } from '../schema-types';
import type { JobAccepted } from '../types/envelopes';
import type { IngestionExceptionDetailView, IngestionExceptionView, ReplayRunView } from '../types/integrations';
import { v2 } from '../v2';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { useV2Command } from './use-v2-command';
import { flattenPages, useV2InfiniteList } from './use-v2-list';
import { useV2TenantId } from './use-v2-tenant';

export type ExceptionFilters = Pick<QueryOf<'/api/v2/ingestion-exceptions', 'get'>, 'state' | 'errorCode' | 'connectionId'>;
export type ReplayBody = BodyOf<'/api/v2/connections/{id}/replays', 'post'>;

const RUN_POLL_MS = 2_000;
const PAGE_SIZE = 100;

/** Quarantine (ING05), newest `lastSeen` first; filters are server-side; pages load as the list scrolls. */
export function useIngestionExceptions(filters: ExceptionFilters) {
  const list = useV2InfiniteList<IngestionExceptionView>({
    resource: 'ingestion-exceptions',
    path: '/ingestion-exceptions',
    query: { ...filters, limit: PAGE_SIZE },
    key: { filters: { ...filters } },
  });
  return { ...list, items: flattenPages(list.data?.pages) };
}

/** One exception with its retained raw delivery (payload for integration writers only). */
export function useIngestionException(id: string | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'ingestion-exceptions', id ?? '-'),
    enabled: Boolean(tenantId && id),
    staleTime: STALE_TIME['ingestion-exceptions'],
    queryFn: async ({ signal }) =>
      (await v2.get<IngestionExceptionDetailView, '/api/v2/ingestion-exceptions/{id}'>('/api/v2/ingestion-exceptions/{id}', {
        path: { id: id as string },
        signal,
      })).data,
  });
}

const isFinal = (run: ReplayRunView | undefined): boolean => run?.state === 'completed' || run?.state === 'failed';

/** State and counts of a replay run, polled until it completes or fails. */
export function useReplayRun(runId: string | null) {
  const tenantId = useV2TenantId();
  return useQuery<ReplayRunView>({
    queryKey: v2Keys.detail(tenantId ?? '-', 'replay-runs', runId ?? '-'),
    enabled: Boolean(tenantId && runId),
    staleTime: STALE_TIME['replay-runs'],
    refetchInterval: (query) => (isFinal(query.state.data) ? false : RUN_POLL_MS),
    queryFn: async ({ signal }) =>
      (await v2.get<ReplayRunView, '/api/v2/replay-runs/{id}'>('/api/v2/replay-runs/{id}', { path: { id: runId as string }, signal })).data,
  });
}

function useIntakeCommand<TInput, TResult>(entityType: string, run: (input: TInput, idempotencyKey: string) => Promise<TResult>) {
  const tenantId = useV2TenantId();
  return useV2Command<TInput, TResult>({
    run: ({ input, idempotencyKey }) => run(input, idempotencyKey),
    changes: () => (tenantId ? { tenantId, entityType } : null),
  });
}

/** Bounded replay of retained raw observations (dry run counts first); 202 + run (API04). */
export function useRequestReplay() {
  return useIntakeCommand<{ connectionId: string; body: ReplayBody }, JobAccepted>('replay_run', async (input, idempotencyKey) =>
    (await v2.post<JobAccepted, '/api/v2/connections/{id}/replays'>('/api/v2/connections/{id}/replays', {
      path: { id: input.connectionId },
      body: input.body,
      idempotencyKey,
    })).data,
  );
}

export type ResolveOutcome = JobAccepted | IngestionExceptionView;

/** `replay` (202 + replay run) or `irrecoverable` with a reason (200); 409 EXCEPTION_NOT_OPEN. */
export function useResolveException() {
  return useIntakeCommand<{ id: string; action: 'replay' | 'irrecoverable'; reason: string }, ResolveOutcome>(
    'ingestion_exception',
    async (input, idempotencyKey) =>
      (await v2.post<ResolveOutcome, '/api/v2/ingestion-exceptions/{id}/resolve'>('/api/v2/ingestion-exceptions/{id}/resolve', {
        path: { id: input.id },
        body: { action: input.action, reason: input.reason },
        idempotencyKey,
      })).data,
  );
}
