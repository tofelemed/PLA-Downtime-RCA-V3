import type { StopEnginePolicy, StopEngineSettings, DerivedStopPreview } from '../types/stop-policy';
import { useQuery } from '@tanstack/react-query';
import { v2Request } from '../client';
import type { MicroStopPolicyBody, MicroStopPolicyView, TransitionAllowanceBody, TransitionAllowanceView } from '../types/reliability';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { useV2Command } from './use-v2-command';
import { useV2TenantId } from './use-v2-tenant';

/** '' = the plant-wide version */
const scopeOf = (unitId: string) => unitId || 'plant';

function usePolicyInForce<T>(path: string, variant: string, unitId: string) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'reliability', scopeOf(unitId), variant),
    enabled: Boolean(tenantId),
    staleTime: STALE_TIME.reliability,
    queryFn: async ({ signal }) =>
      (await v2Request<T>({ method: 'GET', path, query: { unitId: unitId || undefined }, signal })).data,
  });
}

/** SME D6: micro-stop settings in force now for a unit (its override, else plant-wide) or the plant. */
export function useMicroStopPolicy(unitId: string) {
  return usePolicyInForce<MicroStopPolicyView>('/micro-stop-policies/current', 'micro-stop-policy', unitId);
}

/** Engine 2.5.6: whether the plan already allows for standard grade transitions (unit or plant). */
export function useTransitionAllowance(unitId: string) {
  return usePolicyInForce<TransitionAllowanceView>('/transition-allowance-policies/current', 'transition-allowance', unitId);
}

function usePolicyCommand<TBody, TResult>(path: string) {
  const tenantId = useV2TenantId();
  return useV2Command<TBody, TResult>({
    run: async ({ input, idempotencyKey }) => (await v2Request<TResult>({ method: 'POST', path, body: input, idempotencyKey })).data,
    // past periods keep the version they used: only the policy reads change
    changes: () => (tenantId ? { tenantId, entityType: 'reliability' } : null),
  });
}

/** A new approved oee_policy version with these micro-stop settings, effective now (manager approvers). */
export function useRecordMicroStopPolicy() {
  return usePolicyCommand<MicroStopPolicyBody, MicroStopPolicyView>('/micro-stop-policies');
}

/** A new approved oee_policy version with this transition-allowance option, effective now. */
export function useRecordTransitionAllowance() {
  return usePolicyCommand<TransitionAllowanceBody, TransitionAllowanceView>('/transition-allowance-policies');
}

export function useStopEnginePolicy(unitId: string) {
  return usePolicyInForce<StopEnginePolicy>('/stop-event-policies/current', 'stop-engine', unitId);
}
export function useRecordStopEnginePolicy() {
  return usePolicyCommand<StopEngineSettings & { unitId?: string; notes?: string }, StopEnginePolicy>('/stop-event-policies');
}
export function useDerivedStopPreview() {
  return useV2Command<{ unitId: string; from: string; to: string }, DerivedStopPreview>({
    run: async ({ input }) => (await v2Request<DerivedStopPreview>({ method: 'GET', path: '/derived-stops/preview', query: input })).data,
    changes: () => null,
  });
}
