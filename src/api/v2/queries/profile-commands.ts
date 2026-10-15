import { v2Request } from '../client';
import { ifMatchOf } from '../etag-cache';
import type { BodyOf } from '../schema-types';
import type { JobAccepted } from '../types/envelopes';
import type { ProfileView, RateView, TransitionStandardView, ValuationRateView } from '../types/profiles';
import { v2 } from '../v2';
import type { ChangeNotice } from './invalidation';
import { useV2Command } from './use-v2-command';
import { useV2TenantId } from './use-v2-tenant';

/** A baseline change: profiles, rates, and the periods / reports computed from them refresh. */
export function useBaselineCommand<TInput, TResult>(run: (input: TInput, idempotencyKey: string) => Promise<TResult>) {
  const tenantId = useV2TenantId();
  const notice = (): ChangeNotice | null => (tenantId ? { tenantId, entityType: 'production_profile', window: null } : null);
  return useV2Command<TInput, TResult>({ run: ({ input, idempotencyKey }) => run(input, idempotencyKey), changes: notice });
}

export type ProfileCreateBody = BodyOf<'/api/v2/profiles', 'post'>;
export type ProfilePatchBody = BodyOf<'/api/v2/profiles/{id}', 'patch'>;
export type RateCreateBody = BodyOf<'/api/v2/profiles/{id}/rates', 'post'>;
export type ValuationRateCreateBody = BodyOf<'/api/v2/valuation-rates', 'post'>;
export type RateImportBody = BodyOf<'/api/v2/rate-imports', 'post'>;
export type TransitionStandardCreateBody = BodyOf<'/api/v2/transition-standards', 'post'>;

export function useCreateProfile() {
  return useBaselineCommand<ProfileCreateBody, ProfileView>(async (body, idempotencyKey) =>
    (await v2.post<ProfileView, '/api/v2/profiles'>('/api/v2/profiles', { body, idempotencyKey })).data,
  );
}

/** Draft edit with `If-Match` = the row version the user edited (412 → StaleRevisionError). */
export function usePatchProfile() {
  return useBaselineCommand<{ profile: Pick<ProfileView, 'id' | 'rowVersion'>; body: ProfilePatchBody }, ProfileView>(async (input) =>
    (await v2.patch<ProfileView, '/api/v2/profiles/{id}'>('/api/v2/profiles/{id}', {
      path: { id: input.profile.id },
      body: input.body,
      ifMatch: ifMatchOf(input.profile.rowVersion),
    })).data,
  );
}

export function useCreateRate() {
  return useBaselineCommand<{ profileId: string; body: RateCreateBody }, RateView>(async (input, idempotencyKey) =>
    (await v2.post<RateView, '/api/v2/profiles/{id}/rates'>('/api/v2/profiles/{id}/rates', {
      path: { id: input.profileId },
      body: input.body,
      idempotencyKey,
    })).data,
  );
}

export function useCreateValuationRate() {
  return useBaselineCommand<ValuationRateCreateBody, ValuationRateView>(async (body, idempotencyKey) =>
    (await v2.post<ValuationRateView, '/api/v2/valuation-rates'>('/api/v2/valuation-rates', { body, idempotencyKey })).data,
  );
}

/** A draft entry of the grade-transition matrix (LA-08); the open periods of the unit recompute on approval. */
export function useCreateTransitionStandard() {
  return useBaselineCommand<TransitionStandardCreateBody, TransitionStandardView>(async (body, idempotencyKey) =>
    (await v2.post<TransitionStandardView, '/api/v2/transition-standards'>('/api/v2/transition-standards', { body, idempotencyKey })).data,
  );
}

/** Versioned master data with approve / retire commands (plan 2.2, LA-08). */
export type VersionResource = 'profiles' | 'rates' | 'valuation-rates' | 'transition-standards' | 'unit-streams' | 'flow-routes';

export interface VersionTransition {
  resource: VersionResource;
  id: string;
  action: 'approve' | 'retire';
  /** approve only: close the one approved predecessor at this version's effectiveFrom */
  supersede?: boolean;
}

/** Approve (409 VERSION_OVERLAP with `details.conflicts`) or retire a version; the server checks the role. */
export function useVersionTransition() {
  return useBaselineCommand<VersionTransition, ProfileView | RateView | ValuationRateView | TransitionStandardView>(async (input, idempotencyKey) =>
    (await v2Request<ProfileView | RateView | ValuationRateView | TransitionStandardView>({
      method: 'POST',
      path: `/${input.resource}/${input.id}/${input.action}`,
      body: input.action === 'approve' ? { supersede: input.supersede === true } : {},
      idempotencyKey,
    })).data,
  );
}

/** Budget / forecast / MPC import: 202 with a job the dialog follows (`GET /rate-imports/{id}`). */
export function useCreateRateImport() {
  return useBaselineCommand<RateImportBody, JobAccepted>(async (body, idempotencyKey) =>
    (await v2.post<JobAccepted, '/api/v2/rate-imports'>('/api/v2/rate-imports', { body, idempotencyKey })).data,
  );
}
