import { v2Request } from '../client';
import type { VerificationOutcomeView } from '../types/stop-coding';
import { useV2Command } from './use-v2-command';
import { useV2TenantId } from './use-v2-tenant';

/** One stop, a selection, or every unverified stop of a shift period. */
export type VerifyStopsInput = { periodId: string } | { eventIds: string[] };

/** SME D13: the supervisor verifies stop coding; the events, the period and its reports refresh. */
export function useVerifyStops() {
  const tenantId = useV2TenantId();
  return useV2Command<VerifyStopsInput, VerificationOutcomeView>({
    run: async ({ input, idempotencyKey }) =>
      (await v2Request<VerificationOutcomeView>({ method: 'POST', path: '/production-events/verification', body: input, idempotencyKey })).data,
    changes: () => (tenantId ? { tenantId, entityType: 'production_event', window: null } : null),
    retries: 0,
  });
}

/** SME D13: maintenance validates the failure detail of a verified stop. */
export function useValidateFailure() {
  const tenantId = useV2TenantId();
  return useV2Command<{ eventId: string }, VerificationOutcomeView>({
    run: async ({ input, idempotencyKey }) =>
      (await v2Request<VerificationOutcomeView>({ method: 'POST', path: `/production-events/${input.eventId}/validate-failure`, body: {}, idempotencyKey })).data,
    changes: (input) => (tenantId ? { tenantId, entityType: 'production_event', entityId: input.eventId, window: null } : null),
    retries: 0,
  });
}
