import { usePlan } from '@/api/v2/queries/period-overview';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { useUnitNames } from '@/features/ux-kit/labels';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';

/** The plan behind the dashboard pages: the plan, its unit's name, the plant timezone and the load state. */
export function usePlanContext(planId: string | null) {
  const tenantId = useV2TenantId();
  const zone = usePlantTimezone();
  const plan = usePlan(planId);
  const units = useUnitNames();
  const state = dataStateOf(plan);
  return {
    tenantId,
    zone,
    plan,
    state,
    unitName: plan.data ? units.nameOf(plan.data.version.unitId) : 'Unit',
  };
}
