import { useQuery } from '@tanstack/react-query';
import { ifMatchOf } from '../etag-cache';
import type { BodyOf } from '../schema-types';
import type {
  BulkCodeAppliedView,
  BulkCodePreviewView,
  BulkJobView,
  EventOperationView,
} from '../types/event-operations';
import type { JobAccepted } from '../types/envelopes';
import type { EventReviewItemView, ProductionEventView } from '../types/events';
import { v2 } from '../v2';
import type { ChangeNotice } from './invalidation';
import { v2Keys } from './query-keys';
import { useV2Command } from './use-v2-command';
import { useV2TenantId } from './use-v2-tenant';

export type EventRef = Pick<ProductionEventView, 'id' | 'rowVersion' | 'startTime' | 'endTime'>;
type Interval = Pick<EventRef, 'startTime' | 'endTime'>;

/** Change notices of event intervals: events, overlapping periods and reports refresh. */
function eventChanges(tenantId: string | null, events: readonly Interval[]): ChangeNotice[] | null {
  if (!tenantId) return null;
  return events.map((event) => ({
    tenantId,
    entityType: 'production_event',
    window: { from: event.startTime, to: event.endTime },
  }));
}

export type CreateEventBody = BodyOf<'/api/v2/production-events', 'post'>;

/** DT08 manual create (Idempotency-Key per user action; 422 field errors map onto the form). */
export function useCreateProductionEvent() {
  const tenantId = useV2TenantId();
  return useV2Command<CreateEventBody, ProductionEventView>({
    run: async ({ input, idempotencyKey }) =>
      (await v2.post<ProductionEventView, '/api/v2/production-events'>('/api/v2/production-events', {
        body: input,
        idempotencyKey,
      })).data,
    changes: (_input, result) => eventChanges(tenantId, [result]),
  });
}

export interface SplitInput {
  event: EventRef;
  body: BodyOf<'/api/v2/production-events/{id}/split', 'post'>;
}

/** DT09 split with `If-Match` = the row version the user saw (412 → StaleRevisionError). */
export function useSplitEvent() {
  const tenantId = useV2TenantId();
  return useV2Command<SplitInput, EventOperationView>({
    run: async ({ input, idempotencyKey }) =>
      (await v2.post<EventOperationView, '/api/v2/production-events/{id}/split'>(
        '/api/v2/production-events/{id}/split',
        { path: { id: input.event.id }, body: input.body, idempotencyKey, ifMatch: ifMatchOf(input.event.rowVersion) },
      )).data,
    retries: 0,
    changes: (input) => eventChanges(tenantId, [input.event]),
  });
}

export interface CloseInput {
  event: EventRef;
  body: BodyOf<'/api/v2/production-events/{id}/close', 'post'>;
}

/** DT10 close of an open stop (`If-Match`). */
export function useCloseEvent() {
  const tenantId = useV2TenantId();
  return useV2Command<CloseInput, EventOperationView>({
    run: async ({ input, idempotencyKey }) =>
      (await v2.post<EventOperationView, '/api/v2/production-events/{id}/close'>(
        '/api/v2/production-events/{id}/close',
        { path: { id: input.event.id }, body: input.body, idempotencyKey, ifMatch: ifMatchOf(input.event.rowVersion) },
      )).data,
    retries: 0,
    changes: (input) => eventChanges(tenantId, [{ startTime: input.event.startTime, endTime: input.body.endTime }]),
  });
}

export interface MergeInput {
  events: EventRef[];
  body: Omit<BodyOf<'/api/v2/production-events/merge', 'post'>, 'events'>;
}

/** DT09 merge: each event carries the version the user read (`expectedVersion`). */
export function useMergeEvents() {
  const tenantId = useV2TenantId();
  return useV2Command<MergeInput, EventOperationView>({
    run: async ({ input, idempotencyKey }) =>
      (await v2.post<EventOperationView, '/api/v2/production-events/merge'>('/api/v2/production-events/merge', {
        body: { ...input.body, events: input.events.map((e) => ({ eventId: e.id, expectedVersion: e.rowVersion })) },
        idempotencyKey,
      })).data,
    retries: 0,
    changes: (input) => eventChanges(tenantId, input.events),
  });
}

export type BulkCodeBody = BodyOf<'/api/v2/production-events/bulk-code', 'post'>;
export type BulkCodeResult = BulkCodePreviewView | BulkCodeAppliedView | JobAccepted;

/** DT10 bulk coding: preview (nothing changes), apply ≤ 500 atomically, or a 202 job above. */
export function useBulkCode() {
  const tenantId = useV2TenantId();
  return useV2Command<BulkCodeBody, BulkCodeResult>({
    run: async ({ input, idempotencyKey }) =>
      (await v2.post<BulkCodeResult, '/api/v2/production-events/bulk-code'>('/api/v2/production-events/bulk-code', {
        body: input,
        idempotencyKey,
      })).data,
    retries: 0,
    changes: (input) => (input.preview || !tenantId ? null : { tenantId, entityType: 'production_event', window: null }),
  });
}

export function isJobAccepted(result: BulkCodeResult | undefined): result is JobAccepted {
  return typeof result === 'object' && result !== null && 'jobId' in result;
}

export function isBulkPreview(result: BulkCodeResult | undefined): result is BulkCodePreviewView {
  return typeof result === 'object' && result !== null && 'exclusions' in result;
}

const TERMINAL_JOB_STATES = new Set(['completed', 'partial', 'failed']);

export function isTerminalJob(job: Pick<BulkJobView, 'state'> | undefined): boolean {
  return job !== undefined && TERMINAL_JOB_STATES.has(job.state);
}

/** Progress of a bulk job, polled every second until it reaches a terminal state. */
export function useBulkJob(jobId: string | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'jobs', jobId ?? '-'),
    enabled: Boolean(tenantId && jobId),
    queryFn: async ({ signal }) =>
      (await v2.get<BulkJobView, '/api/v2/jobs/{id}'>('/api/v2/jobs/{id}', { path: { id: jobId as string }, signal })).data,
    refetchInterval: (query) => (isTerminalJob(query.state.data) ? false : 1000),
  });
}

export interface ResolveReviewInput {
  item: Pick<EventReviewItemView, 'id'>;
  event: EventRef;
  decision: BodyOf<'/api/v2/event-review-items/{id}/resolve', 'post'>['decision'];
}

/** §5.3 review decision: keep the user's override or accept the source value. */
export function useResolveReviewItem() {
  const tenantId = useV2TenantId();
  return useV2Command<ResolveReviewInput, unknown>({
    run: async ({ input, idempotencyKey }) =>
      (await v2.post<unknown, '/api/v2/event-review-items/{id}/resolve'>('/api/v2/event-review-items/{id}/resolve', {
        path: { id: input.item.id },
        body: { decision: input.decision },
        idempotencyKey,
      })).data,
    changes: (input) => eventChanges(tenantId, [input.event]),
  });
}
