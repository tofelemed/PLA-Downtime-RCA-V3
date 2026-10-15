import { useMutation, useQuery } from '@tanstack/react-query';
import { v2Request } from '../client';
import type { ListResponse } from '../types/envelopes';
import type { AdoptedToleranceView, UncertaintyBudgetCreateBody, UncertaintyBudgetView, UncertaintyPreviewBody, UncertaintyResultView } from '../types/uncertainty';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { useV2Command } from './use-v2-command';
import { useV2TenantId } from './use-v2-tenant';

/** Most budgets a unit lists (a few boundaries, a few versions each). */
const PAGE = 200;

/** SME E4: the uncertainty budgets of a unit, newest effective date first (in force, ended, proposed, rejected). */
export function useUncertaintyBudgets(unitId: string | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.list(tenantId ?? '-', 'uncertainty-budgets', { scope: { unitIds: unitId ? [unitId] : [] } }),
    enabled: Boolean(tenantId && unitId),
    staleTime: STALE_TIME['uncertainty-budgets'],
    queryFn: async ({ signal }) =>
      (await v2Request<ListResponse<UncertaintyBudgetView>>({ method: 'GET', path: '/uncertainty-budgets', query: { unitId: unitId ?? '', limit: PAGE }, signal })).data,
  });
}

/** The server's combined and expanded uncertainty of a draft; nothing is stored (the browser never computes them). */
export function useUncertaintyPreview() {
  return useMutation({
    mutationFn: async (body: UncertaintyPreviewBody) => (await v2Request<UncertaintyResultView>({ method: 'POST', path: '/uncertainty-budgets/preview', body })).data,
  });
}

function useBudgetCommand<TInput, TResult>(path: (input: TInput) => string, body: (input: TInput) => unknown, entityType = 'uncertainty_budget') {
  const tenantId = useV2TenantId();
  return useV2Command<TInput, TResult>({
    run: async ({ input, idempotencyKey }) => (await v2Request<TResult>({ method: 'POST', path: path(input), body: body(input), idempotencyKey })).data,
    changes: () => (tenantId ? { tenantId, entityType } : null),
    retries: 0,
  });
}

/** Proposes a budget (production / process engineering, integration, production accounting, managers). */
export function useProposeUncertaintyBudget() {
  return useBudgetCommand<UncertaintyBudgetCreateBody, UncertaintyBudgetView>(
    () => '/uncertainty-budgets',
    (input) => input,
  );
}

/** Production accounting approves or rejects a proposed budget (never its author: 403 SEPARATION_OF_DUTIES). */
export function useDecideUncertaintyBudget() {
  return useBudgetCommand<{ id: string; decision: 'approve' | 'reject'; reason?: string }, UncertaintyBudgetView>(
    ({ id, decision }) => `/uncertainty-budgets/${id}/${decision}`,
    ({ reason }) => (reason ? { reason } : {}),
  );
}

/** Explicitly makes the budget's expanded uncertainty the unit's absolute reconciliation tolerance. */
export function useAdoptBudgetAsTolerance() {
  return useBudgetCommand<{ id: string; notes?: string }, AdoptedToleranceView>(
    ({ id }) => `/uncertainty-budgets/${id}/adopt-as-tolerance`,
    ({ notes }) => (notes ? { notes } : {}),
    'reconciliation_tolerance',
  );
}
