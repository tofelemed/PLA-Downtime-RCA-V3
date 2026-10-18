import { v2Request } from '../client';
import { ifMatchOf } from '../etag-cache';
import type { RcaAnalysesView, RcaAnalysisBodies, RcaRecordTool } from '../types/rca-analyses';
import type { BodyOf } from '../schema-types';
import type { RcaCaseCauseBody, RcaCaseCausePatch, RcaCaseCauseView } from '../types/rca-causes';
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
export type RcaTransitionBody = BodyOf<'/api/v2/rcas/{id}/transitions', 'post'>;
export type RcaBaselineCorrectionBody = BodyOf<'/api/v2/rca-actions/{id}/baseline-correction', 'post'>;
export type RcaBaselineDecisionBody = BodyOf<'/api/v2/rca-actions/{id}/baseline-correction/decision', 'post'>;

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

/** RCA-01 workflow move (`POST /v2/rcas/{id}/transitions`, If-Match); answers the case after the move. */
export function useTransitionRcaCase() {
  return useRcaCommand<{ rca: Pick<RcaCaseView, 'id' | 'rowVersion'>; body: RcaTransitionBody }, RcaCaseView>(async (input, idempotencyKey) =>
    (await v2.post<RcaCaseView, '/api/v2/rcas/{id}/transitions'>('/api/v2/rcas/{id}/transitions', {
      path: { id: input.rca.id },
      body: input.body,
      idempotencyKey,
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

type ActionRef = Pick<RcaActionView, 'id' | 'rowVersion'>;

/** CA3: proposes a corrected baseline value with a reason; another person decides on it. */
export function useProposeBaselineCorrection() {
  return useRcaCommand<{ action: ActionRef; body: RcaBaselineCorrectionBody }, RcaActionView>(async (input, idempotencyKey) =>
    (await v2.post<RcaActionView, '/api/v2/rca-actions/{id}/baseline-correction'>('/api/v2/rca-actions/{id}/baseline-correction', {
      path: { id: input.action.id },
      body: input.body,
      idempotencyKey,
      ifMatch: ifMatchOf(input.action.rowVersion),
    })).data,
  );
}

/** CA3: a manager approver other than the proposer approves or rejects the pending correction. */
export function useDecideBaselineCorrection() {
  return useRcaCommand<{ action: ActionRef; body: RcaBaselineDecisionBody }, RcaActionView>(async (input, idempotencyKey) =>
    (await v2.post<RcaActionView, '/api/v2/rca-actions/{id}/baseline-correction/decision'>('/api/v2/rca-actions/{id}/baseline-correction/decision', {
      path: { id: input.action.id },
      body: input.body,
      idempotencyKey,
      ifMatch: ifMatchOf(input.action.rowVersion),
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

/** Deletes an open case nothing refers to yet (409 RCA_CASE_IN_USE otherwise). */
export function useDeleteRcaCase() {
  return useRcaCommand<Pick<RcaCaseView, 'id' | 'rowVersion'>, void>(async (rca) => {
    await v2Request<void>({ method: 'DELETE', path: `/rcas/${encodeURIComponent(rca.id)}`, ifMatch: ifMatchOf(rca.rowVersion) });
  });
}

/** Replaces the logic tree with a fresh copy of the case's template. */
export function useResetRcaLogicTree() {
  return useRcaCommand<Pick<RcaCaseView, 'id' | 'rowVersion'>, RcaCaseView>(async (rca, idempotencyKey) =>
    (await v2.post<RcaCaseView, '/api/v2/rcas/{id}/logic-tree/reset'>('/api/v2/rcas/{id}/logic-tree/reset', {
      path: { id: rca.id },
      idempotencyKey,
      ifMatch: ifMatchOf(rca.rowVersion),
    })).data,
  );
}

/** Item 7: adds a typed cause to a case (Idempotency-Key; 422 CAUSES_LOCKED once closure is requested). */
export function useCreateRcaCause() {
  return useRcaCommand<{ rcaId: string; body: RcaCaseCauseBody }, RcaCaseCauseView>(async (input, idempotencyKey) =>
    (await v2.post<RcaCaseCauseView, '/api/v2/rcas/{id}/causes'>('/api/v2/rcas/{id}/causes', {
      path: { id: input.rcaId },
      body: input.body,
      idempotencyKey,
    })).data,
  );
}

type CauseRef = Pick<RcaCaseCauseView, 'id' | 'rowVersion'>;

/** Item 7: changes a cause with `If-Match` = the version on screen (412 when someone saved in between). */
export function useUpdateRcaCause() {
  return useRcaCommand<{ cause: CauseRef; body: RcaCaseCausePatch }, RcaCaseCauseView>(async (input) =>
    (await v2.patch<RcaCaseCauseView, '/api/v2/rca-case-causes/{id}'>('/api/v2/rca-case-causes/{id}', {
      path: { id: input.cause.id },
      body: input.body,
      ifMatch: ifMatchOf(input.cause.rowVersion),
    })).data,
  );
}

/** Item 7: removes a cause (If-Match). */
export function useDeleteRcaCause() {
  return useRcaCommand<CauseRef, void>(async (cause) => {
    await v2Request<void>({ method: 'DELETE', path: `/rca-case-causes/${encodeURIComponent(cause.id)}`, ifMatch: ifMatchOf(cause.rowVersion) });
  });
}

const TOOL_PATHS: Readonly<Record<RcaRecordTool, string>> = {
  fiveWhy: 'five-why',
  fishbone: 'fishbone',
  fmea: 'fmea',
  faultTree: 'fault-tree',
  barrier: 'barrier',
  change: 'change',
};

export interface SaveRcaAnalysisInput<K extends RcaRecordTool> {
  rcaId: string;
  tool: K;
  body: RcaAnalysisBodies[K];
  /** row version of the record read; null for the first save of the tool */
  rowVersion: number | null;
}

/** Saves one analysis tool record (first save without If-Match; later saves with the version read). */
export function useSaveRcaAnalysis<K extends RcaRecordTool>() {
  return useRcaCommand<SaveRcaAnalysisInput<K>, NonNullable<RcaAnalysesView[K]>>(async (input) =>
    (await v2Request<NonNullable<RcaAnalysesView[K]>>({
      method: 'PUT',
      path: `/rcas/${encodeURIComponent(input.rcaId)}/analyses/${TOOL_PATHS[input.tool]}`,
      body: input.body,
      ifMatch: input.rowVersion === null ? undefined : ifMatchOf(input.rowVersion),
    })).data,
  );
}
