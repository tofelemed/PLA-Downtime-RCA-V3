import { useQueryClient } from '@tanstack/react-query';
import { usePagedQuery } from '@/api/v2/queries/use-paged-query';
import { v2Keys } from '@/api/v2/queries/query-keys';
import { STALE_TIME } from '@/api/v2/queries/stale-times';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { ApprovalState, PlanVersionView, PlanView } from '@/api/v2/types/plans';
import { v2 } from '@/api/v2/v2';

export interface PlanListFilters {
  unitId: string;
  state: ApprovalState | '';
}

/** Plans with their current version, 20 per page (server keyset), filtered by unit and version state. */
export function usePagedPlans({ unitId, state }: PlanListFilters) {
  return usePagedQuery<PlanView>({
    resource: 'plans',
    path: '/production-plans',
    query: { ...(unitId ? { unitId } : {}), ...(state ? { approvalState: state } : {}) },
    key: { scope: unitId ? { unitIds: [unitId] } : null, filters: { kind: 'plans', state } },
  });
}

/** Warms the plan version a row opens (same key as `usePlanVersion`), e.g. on row hover. */
export function usePrefetchPlanVersion() {
  const queryClient = useQueryClient();
  const tenantId = useV2TenantId();
  return (plan: Pick<PlanView, 'id' | 'currentVersion'>) => {
    if (!tenantId || !plan.currentVersion) return;
    const version = plan.currentVersion;
    void queryClient.prefetchQuery({
      queryKey: v2Keys.detail(tenantId, 'plans', plan.id, `v${version}`),
      staleTime: STALE_TIME.plans,
      queryFn: async ({ signal }) =>
        (await v2.get<PlanVersionView, '/api/v2/production-plans/{id}/versions/{version}'>('/api/v2/production-plans/{id}/versions/{version}', {
          path: { id: plan.id, version },
          signal,
        })).data,
    });
  };
}
