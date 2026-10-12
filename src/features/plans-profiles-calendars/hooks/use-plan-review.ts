import { v2Request } from '@/api/v2/client';
import type { ChangeNotice } from '@/api/v2/queries/invalidation';
import { useV2Command } from '@/api/v2/queries/use-v2-command';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { PlanVersionView } from '@/api/v2/types/plans';

export interface SubmitPlanInput {
  planId: string;
  expectedVersion: number;
}

export interface ReturnPlanInput extends SubmitPlanInput {
  reason: string;
}

function usePlanReviewCommand<TInput extends SubmitPlanInput>(action: 'submit' | 'return') {
  const tenantId = useV2TenantId();
  const notice = (): ChangeNotice | null => (tenantId ? { tenantId, entityType: 'production_plan', window: null } : null);
  return useV2Command<TInput, PlanVersionView>({
    run: async ({ input, idempotencyKey }) => {
      const { planId, ...body } = input;
      return (await v2Request<PlanVersionView>({ method: 'POST', path: `/production-plans/${planId}/${action}`, body, idempotencyKey })).data;
    },
    changes: notice,
  });
}

/** The author hands the open version to a manager approver (draft → submitted). */
export function useSubmitPlan() {
  return usePlanReviewCommand<SubmitPlanInput>('submit');
}

/** A manager approver sends the open version back to its author with a reason (→ draft). */
export function useReturnPlan() {
  return usePlanReviewCommand<ReturnPlanInput>('return');
}
