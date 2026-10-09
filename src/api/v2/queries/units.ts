import type { QueryParams } from '../request-url';
import type { ShiftInstanceView, UnitView } from '../types/units';
import { useV2InfiniteList } from './use-v2-list';

/** Units of the caller's scope (unit-limited users get only their units; plan 3.2). */
export function useUnits() {
  return useV2InfiniteList<UnitView>({
    resource: 'units',
    path: '/units',
    query: { limit: 500 },
    key: {},
  });
}

export interface ShiftInstanceQuery {
  unitId: string;
  from: string;
  to: string;
}

/** Generated shift instances of one unit overlapping a window (plan 2.1), for the shift picker. */
export function useShiftInstances(query: ShiftInstanceQuery | null) {
  return useV2InfiniteList<ShiftInstanceView>({
    resource: 'shift-instances',
    path: '/shift-instances',
    query: { ...(query ?? {}), sort: '-utcStart', limit: 50 } as QueryParams,
    key: { scope: { unitIds: query ? [query.unitId] : [] }, window: query ? { from: query.from, to: query.to } : null },
    enabled: query !== null,
  });
}
