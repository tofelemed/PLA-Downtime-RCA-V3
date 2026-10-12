import { v2Request } from '@/api/v2/client';
import type { EventRef } from '@/api/v2/queries/event-commands';
import { ifMatchOf } from '@/api/v2/etag-cache';
import { useV2Command } from '@/api/v2/queries/use-v2-command';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { EventOperationView } from '@/api/v2/types/event-operations';

export interface RetractInput {
  event: EventRef;
  reason: string;
}

/**
 * Retraction of a manual event (`POST /production-events/{id}/retract`, If-Match): the v2 form of the
 * v1 delete. Nothing is deleted — the event is kept as "Retracted" with the reason in its history and
 * drops out of figures on the next recalculation.
 */
export function useRetractEvent() {
  const tenantId = useV2TenantId();
  return useV2Command<RetractInput, EventOperationView>({
    run: async ({ input, idempotencyKey }) =>
      (
        await v2Request<EventOperationView>({
          method: 'POST',
          path: `/production-events/${input.event.id}/retract`,
          body: { reason: input.reason },
          idempotencyKey,
          ifMatch: ifMatchOf(input.event.rowVersion),
        })
      ).data,
    retries: 0,
    changes: (input) =>
      tenantId
        ? { tenantId, entityType: 'production_event', entityId: input.event.id, window: { from: input.event.startTime, to: input.event.endTime } }
        : null,
  });
}
