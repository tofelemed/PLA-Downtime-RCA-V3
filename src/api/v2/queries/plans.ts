import { useQuery } from '@tanstack/react-query';
import { ifMatchOf } from '../etag-cache';
import type { BodyOf } from '../schema-types';
import type { JobAccepted } from '../types/envelopes';
import type {
  Distribution,
  PlanGenerationJobView,
  PlanPreviewView,
  PlanScenarioView,
  PlanVersionView,
  PlanView,
} from '../types/plans';
import { v2 } from '../v2';
import type { ChangeNotice } from './invalidation';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { useV2Command } from './use-v2-command';
import { useV2InfiniteList } from './use-v2-list';
import { useV2TenantId } from './use-v2-tenant';

/** Plans with their current version (plan 2.3), optionally of one unit. */
export function usePlans(unitId?: string) {
  return useV2InfiniteList<PlanView>({
    resource: 'plans',
    path: '/production-plans',
    query: { ...(unitId ? { unitId } : {}), limit: 200 },
    key: { scope: unitId ? { unitIds: [unitId] } : null, filters: { kind: 'plans' } },
  });
}

export function usePlanScenarios() {
  return useV2InfiniteList<PlanScenarioView>({ resource: 'plans', path: '/plan-scenarios', query: { limit: 100 }, key: { filters: { kind: 'scenarios' } } });
}

/** Version history, newest first (plan 3.4 endpoint; no slices). */
export function usePlanVersions(planId: string | null) {
  return useV2InfiniteList<PlanVersionView>({
    resource: 'plans',
    path: `/production-plans/${planId ?? '-'}/versions`,
    query: { limit: 100 },
    key: { filters: { kind: 'plan-versions', planId } },
    enabled: planId !== null,
  });
}

/** One version with its slices (ETag = rowVersion). */
export function usePlanVersion(planId: string | null, version: number | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'plans', planId ?? '-', `v${version ?? '-'}`),
    enabled: Boolean(tenantId && planId && version),
    staleTime: STALE_TIME.plans,
    queryFn: async ({ signal }) =>
      (await v2.get<PlanVersionView, '/api/v2/production-plans/{id}/versions/{version}'>('/api/v2/production-plans/{id}/versions/{version}', {
        path: { id: planId as string, version: version as number },
        signal,
      })).data,
  });
}

function usePlanCommand<TInput, TResult>(run: (input: TInput, idempotencyKey: string) => Promise<TResult>, mutates = true) {
  const tenantId = useV2TenantId();
  const notice = (): ChangeNotice | null => (mutates && tenantId ? { tenantId, entityType: 'production_plan', window: null } : null);
  return useV2Command<TInput, TResult>({ run: ({ input, idempotencyKey }) => run(input, idempotencyKey), changes: notice });
}

export type PlanCreateBody = BodyOf<'/api/v2/production-plans', 'post'>;
export type PlanVersionChangeBody = BodyOf<'/api/v2/production-plans/{id}/versions', 'post'>;

export function useCreatePlan() {
  return usePlanCommand<PlanCreateBody, PlanView>(async (body, idempotencyKey) =>
    (await v2.post<PlanView, '/api/v2/production-plans'>('/api/v2/production-plans', { body, idempotencyKey })).data,
  );
}

/** Opens the next draft after an approval (PLAN04: approved versions are never edited). */
export function useNewPlanVersion() {
  return usePlanCommand<{ planId: string; body: PlanVersionChangeBody }, PlanVersionView>(async (input, idempotencyKey) =>
    (await v2.post<PlanVersionView, '/api/v2/production-plans/{id}/versions'>('/api/v2/production-plans/{id}/versions', {
      path: { id: input.planId },
      body: input.body,
      idempotencyKey,
    })).data,
  );
}

export function usePatchPlanVersion() {
  return usePlanCommand<{ version: Pick<PlanVersionView, 'planId' | 'version' | 'rowVersion'>; body: PlanVersionChangeBody }, PlanVersionView>(
    async (input) =>
      (await v2.patch<PlanVersionView, '/api/v2/production-plans/{id}/versions/{version}'>('/api/v2/production-plans/{id}/versions/{version}', {
        path: { id: input.version.planId, version: input.version.version },
        body: input.body,
        ifMatch: ifMatchOf(input.version.rowVersion),
      })).data,
  );
}

export interface GenerateInput {
  planId: string;
  version: number;
  distribution?: Distribution;
}

/** PLAN03 preview (200, nothing stored): started by the user, never on render. */
export function usePreviewPeriods() {
  return usePlanCommand<GenerateInput, PlanPreviewView>(async (input, idempotencyKey) =>
    (await v2.post<PlanPreviewView, '/api/v2/production-plans/{id}/generate-periods'>('/api/v2/production-plans/{id}/generate-periods', {
      path: { id: input.planId },
      body: { version: input.version, distribution: input.distribution, preview: true },
      idempotencyKey,
    })).data,
  false);
}

/** Stores the periods of the open version: 202 + job (API04). */
export function useGeneratePeriods() {
  return usePlanCommand<GenerateInput, JobAccepted>(async (input, idempotencyKey) =>
    (await v2.post<JobAccepted, '/api/v2/production-plans/{id}/generate-periods'>('/api/v2/production-plans/{id}/generate-periods', {
      path: { id: input.planId },
      body: { version: input.version, distribution: input.distribution, preview: false },
      idempotencyKey,
    })).data,
  );
}

const TERMINAL = new Set(['completed', 'failed']);

export function usePlanGenerationJob(jobId: string | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'jobs', jobId ?? '-', 'plan-generation'),
    enabled: Boolean(tenantId && jobId),
    queryFn: async ({ signal }) =>
      (await v2.get<PlanGenerationJobView, '/api/v2/plan-generation-jobs/{id}'>('/api/v2/plan-generation-jobs/{id}', { path: { id: jobId as string }, signal })).data,
    refetchInterval: (query) => (query.state.data && TERMINAL.has(query.state.data.state) ? false : 1500),
  });
}

/** Approval by a manager approver (server-gated: 403 otherwise; 409 PLAN_OVERLAP with conflicts). */
export function useApprovePlan() {
  return usePlanCommand<{ planId: string; expectedVersion: number; reason?: string }, PlanVersionView>(async (input, idempotencyKey) =>
    (await v2.post<PlanVersionView, '/api/v2/production-plans/{id}/approve'>('/api/v2/production-plans/{id}/approve', {
      path: { id: input.planId },
      body: { expectedVersion: input.expectedVersion, ...(input.reason ? { reason: input.reason } : {}) },
      idempotencyKey,
    })).data,
  );
}
