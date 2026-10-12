import { useQuery } from '@tanstack/react-query';
import type { BodyOf } from '../schema-types';
import type { IngestionJobView, JobAction, JobState, JobTransitionView } from '../types/integrations';
import { v2 } from '../v2';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { useV2Command } from './use-v2-command';
import { flattenPages, useV2InfiniteList } from './use-v2-list';
import { useV2TenantId } from './use-v2-tenant';

export type JobCreateBody = BodyOf<'/api/v2/connections/{id}/jobs', 'post'>;

/** Live job state (lease, heartbeat, cursor, health) is polled while a job is active and the tab visible. */
export const JOB_POLL_MS = 5_000;

/** States whose lease / heartbeat / cursor move on their own; every other state changes only by a command. */
const ACTIVE_JOB_STATES: ReadonlySet<string> = new Set<JobState>(['running', 'draining']);

/** Poll interval for a set of job states: only while one is active (commands and realtime refresh the rest). */
export function jobPollInterval(states: ReadonlyArray<string | null | undefined>): number | false {
  return states.some((state) => state && ACTIVE_JOB_STATES.has(state)) ? JOB_POLL_MS : false;
}

/** Ingestion jobs of one connection, oldest first (plan 1.5, ING02). */
export function useIngestionJobs(connectionId: string) {
  const list = useV2InfiniteList<IngestionJobView>({
    resource: 'ingestion-jobs',
    path: '/ingestion-jobs',
    query: { connectionId, limit: 100 },
    key: { filters: { connectionId } },
    refetchInterval: (pages) => jobPollInterval(flattenPages(pages).map((job) => job.state)),
  });
  return { ...list, items: flattenPages(list.data?.pages) };
}

/** Audit trail of a job (commands, lease take-overs, drained, failed), oldest first. */
export function useJobTransitions(jobId: string | null) {
  const tenantId = useV2TenantId();
  return useQuery<JobTransitionView[]>({
    queryKey: v2Keys.detail(tenantId ?? '-', 'ingestion-jobs', jobId ?? '-', 'transitions'),
    enabled: Boolean(tenantId && jobId),
    staleTime: STALE_TIME['ingestion-jobs'],
    // the last transition says where the job is; stopped / failed / paused jobs never poll
    refetchInterval: (query) => jobPollInterval([query.state.data?.at(-1)?.toState]),
    refetchIntervalInBackground: false,
    queryFn: async ({ signal }) =>
      (await v2.get<JobTransitionView[], '/api/v2/ingestion-jobs/{id}/transitions'>('/api/v2/ingestion-jobs/{id}/transitions', {
        path: { id: jobId as string },
        signal,
      })).data,
  });
}

function useJobCommandOf<TInput>(run: (input: TInput, idempotencyKey: string) => Promise<IngestionJobView>) {
  const tenantId = useV2TenantId();
  return useV2Command<TInput, IngestionJobView>({
    run: ({ input, idempotencyKey }) => run(input, idempotencyKey),
    changes: () => (tenantId ? { tenantId, entityType: 'ingestion_job' } : null),
  });
}

/** Creates a job for a scope of the connection (409 JOB_SCOPE_EXISTS for a duplicate active scope). */
export function useCreateJob() {
  return useJobCommandOf<{ connectionId: string; body: JobCreateBody }>(async (input, idempotencyKey) =>
    (await v2.post<IngestionJobView, '/api/v2/connections/{id}/jobs'>('/api/v2/connections/{id}/jobs', {
      path: { id: input.connectionId },
      body: input.body,
      idempotencyKey,
    })).data,
  );
}

/** start | pause | resume | drain | stop, audited with the reason (409 INVALID_TRANSITION). */
export function useJobCommand() {
  return useJobCommandOf<{ jobId: string; action: JobAction; reason: string }>(async (input, idempotencyKey) =>
    (await v2.post<IngestionJobView, '/api/v2/ingestion-jobs/{id}/{action}'>('/api/v2/ingestion-jobs/{id}/{action}', {
      path: { id: input.jobId, action: input.action },
      body: { reason: input.reason },
      idempotencyKey,
    })).data,
  );
}
