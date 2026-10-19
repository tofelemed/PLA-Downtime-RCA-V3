import { useProfiles } from '@/api/v2/queries/profiles';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import type { PlanVersionView } from '@/api/v2/types/plans';
import { targetUomOf } from '../model/plan-target-uom';

/** The unit of the version's targets, from the approved profiles of its unit and slice products (null while loading or mixed). */
export function usePlanTargetUom(version: PlanVersionView): string | null {
  const profiles = useProfiles({ unitId: version.unitId, state: 'approved' });
  return targetUomOf(flattenPages(profiles.data?.pages), (version.slices ?? []).map((slice) => slice.productId));
}
