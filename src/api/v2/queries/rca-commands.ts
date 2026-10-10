import { ifMatchOf } from '../etag-cache';
import type { BodyOf } from '../schema-types';
import type { RcaActionView, RcaCaseView, RcaLinkResultView, RcaRecommendationView } from '../types/rca';
import { v2 } from '../v2';
import type { ChangeNotice } from './invalidation';
import { useV2Command } from './use-v2-command';
import { useV2TenantId } from './use-v2-tenant';

export type RcaCaseBody = BodyOf<'/api/v2/rcas', 'post'>;
export type RcaCasePatch = BodyOf<'/api/v2/rcas/{id}', 'patch'>;
export type EventRcaLinkBody = BodyOf<'/api/v2/production-events/{id}/rca-link', 'post'>;
export type RcaLinkBody = BodyOf<'/api/v2/rcas/{id}/links', 'post'>;
export type RcaActionBody = BodyOf<'/api/v2/rcas/{id}/actions', 'post'>;
export type RcaActionPatch = BodyOf<'/api/v2/rca-actions/{id}', 'patch'>;

/** Everything an RCA write can change: cases (and their links / actions), recommendations, events. */
function rcaChange(tenantId: string | null): ChangeNotice | null {
  return tenantId ? { tenantId, entityType: 'rca_case' } : null;
}

function useRcaCommand<TInput, TResult>(run: (input: TInput, idempotencyKey: string) => Promise<TResult>) {
  const tenantId = useV2TenantId();
  return useV2Command<TInput, TResult>({
    run: ({ input, idempotencyKey }) => run(input, idempotencyKey),
    changes: () => rcaChange(tenantId),
    retries: 0,
  });
}

export function useCreateRcaCase() {
  return useRcaCommand<RcaCaseBody, RcaCaseView>(async (body, idempotencyKey) =>
    (await v2.post<RcaCaseView, '/api/v2/rcas'>('/api/v2/rcas', { body, idempotencyKey })).data,
  );
}

/** PATCH with `If-Match` = the row version the user edited (412 when someone saved in between). */
export function useUpdateRcaCase() {
  return useRcaCommand<{ rca: Pick<RcaCaseView, 'id' | 'rowVersion'>; body: RcaCasePatch }, RcaCaseView>(async (input) =>
    (await v2.patch<RcaCaseView, '/api/v2/rcas/{id}'>('/api/v2/rcas/{id}', {
      path: { id: input.rca.id },
      body: input.body,
      ifMatch: ifMatchOf(input.rca.rowVersion),
    })).data,
  );
}

/** §15.2 link of an event to an existing case or a new one (idempotent: an existing link answers 200). */
export function useLinkEventToRca() {
  return useRcaCommand<{ eventId: string; body: EventRcaLinkBody }, RcaLinkResultView>(async (input, idempotencyKey) =>
    (await v2.post<RcaLinkResultView, '/api/v2/production-events/{id}/rca-link'>('/api/v2/production-events/{id}/rca-link', {
      path: { id: input.eventId },
      body: input.body,
      idempotencyKey,
    })).data,
  );
}

export function useLinkTargetToRca() {
  return useRcaCommand<{ rcaId: string; body: RcaLinkBody }, RcaLinkResultView>(async (input, idempotencyKey) =>
    (await v2.post<RcaLinkResultView, '/api/v2/rcas/{id}/links'>('/api/v2/rcas/{id}/links', {
      path: { id: input.rcaId },
      body: input.body,
      idempotencyKey,
    })).data,
  );
}

export function useCreateRcaAction() {
  return useRcaCommand<{ rcaId: string; body: RcaActionBody }, RcaActionView>(async (input, idempotencyKey) =>
    (await v2.post<RcaActionView, '/api/v2/rcas/{id}/actions'>('/api/v2/rcas/{id}/actions', {
      path: { id: input.rcaId },
      body: input.body,
      idempotencyKey,
    })).data,
  );
}

export function useUpdateRcaAction() {
  return useRcaCommand<{ action: Pick<RcaActionView, 'id' | 'rowVersion'>; body: RcaActionPatch }, RcaActionView>(
    async (input) =>
      (await v2.patch<RcaActionView, '/api/v2/rca-actions/{id}'>('/api/v2/rca-actions/{id}', {
        path: { id: input.action.id },
        body: input.body,
        ifMatch: ifMatchOf(input.action.rowVersion),
      })).data,
  );
}

/** Runs the verification of an action whose window has ended (the worker does it hourly as well). */
export function useVerifyRcaAction() {
  return useRcaCommand<Pick<RcaActionView, 'id' | 'rowVersion'>, RcaActionView>(async (action, idempotencyKey) =>
    (await v2.post<RcaActionView, '/api/v2/rca-actions/{id}/verify'>('/api/v2/rca-actions/{id}/verify', {
      path: { id: action.id },
      idempotencyKey,
      ifMatch: ifMatchOf(action.rowVersion),
    })).data,
  );
}

export function useDismissRcaRecommendation() {
  return useRcaCommand<{ id: string; reason: string }, RcaRecommendationView>(async (input, idempotencyKey) =>
    (await v2.post<RcaRecommendationView, '/api/v2/rca-recommendations/{id}/dismiss'>(
      '/api/v2/rca-recommendations/{id}/dismiss',
      { path: { id: input.id }, body: { reason: input.reason }, idempotencyKey },
    )).data,
  );
}
