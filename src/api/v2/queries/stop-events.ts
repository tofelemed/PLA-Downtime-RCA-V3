import { useQuery } from '@tanstack/react-query';
import { v2Request } from '../client';
import type { ListResponse } from '../types/envelopes';
import type { StopIncidentView, StopReconciliationView } from '../types/stop-events';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { useV2Command } from './use-v2-command';
import { useV2TenantId } from './use-v2-tenant';

/** DT-04: duplicate-stop pairs with the event on either side (merged, suggested, rejected, undone, expired). */
export function useEventDuplicates(eventId: string | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'production-events', eventId ?? '-', 'duplicates'),
    enabled: Boolean(tenantId && eventId),
    staleTime: STALE_TIME['production-events'],
    queryFn: async ({ signal }) =>
      (
        await v2Request<ListResponse<StopReconciliationView>>({
          method: 'GET',
          path: '/stop-reconciliations',
          query: { eventId, limit: 50 },
          signal,
        })
      ).data.items,
  });
}

const isIncident = (value: unknown): value is StopIncidentView =>
  typeof value === 'object' && value !== null && 'id' in value;

/** SME D5: the repeat-stop incident of the event's occurrence; null when it is not a repeat. */
export function useEventIncident(eventId: string | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'production-events', eventId ?? '-', 'incident'),
    enabled: Boolean(tenantId && eventId),
    staleTime: STALE_TIME['production-events'],
    queryFn: async ({ signal }) => {
      const { data } = await v2Request<unknown>({
        method: 'GET',
        path: `/stop-incidents/by-event/${eventId as string}`,
        signal,
      });
      return isIncident(data) ? data : null;
    },
  });
}

export type DuplicateDecision = 'accept' | 'reject' | 'undo';

/** Accept / reject a suggested duplicate, or undo a merge (the reason is kept with the decision). */
export function useDuplicateDecision() {
  const tenantId = useV2TenantId();
  return useV2Command<{ id: string; decision: DuplicateDecision; reason: string }, StopReconciliationView>({
    run: async ({ input, idempotencyKey }) =>
      (
        await v2Request<StopReconciliationView>({
          method: 'POST',
          path: `/stop-reconciliations/${input.id}/${input.decision}`,
          body: { reason: input.reason },
          idempotencyKey,
        })
      ).data,
    // a merge supersedes or restores events: lists, KPIs and accounting read them
    changes: () => (tenantId ? [{ tenantId, entityType: 'production_event' }] : null),
  });
}

/** Mark the stop as a new failure (verified repair before it), or remove the mark with `reason: null`. */
export function useNewFailureMark() {
  const tenantId = useV2TenantId();
  return useV2Command<{ occurrenceId: string; reason: string | null }, null>({
    run: async ({ input, idempotencyKey }) => {
      if (input.reason === null) {
        await v2Request<unknown>({ method: 'DELETE', path: `/stop-incidents/new-failure-marks/${input.occurrenceId}` });
        return null;
      }
      await v2Request<unknown>({
        method: 'POST',
        path: '/stop-incidents/new-failure-marks',
        body: { occurrenceId: input.occurrenceId, reason: input.reason },
        idempotencyKey,
      });
      return null;
    },
    changes: () => (tenantId ? [{ tenantId, entityType: 'production_event' }] : null),
  });
}
