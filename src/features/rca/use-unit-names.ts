import { useMemo } from 'react';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { useUnits } from '@/api/v2/queries/units';
import type { UnitView } from '@/api/v2/types/units';

/** Units of the caller's scope and a name lookup (an unknown id shows as "Unit …", never guessed). */
export function useUnitNames(): { units: UnitView[]; unitName: (id: string | null) => string } {
  const query = useUnits();
  const units = useMemo(() => flattenPages(query.data?.pages), [query.data]);
  return useMemo(() => {
    const names = new Map(units.map((unit) => [unit.id, unit.name]));
    return {
      units,
      unitName: (id: string | null) => (id ? (names.get(id) ?? `Unit ${id.slice(0, 8)}`) : 'Tenant-wide'),
    };
  }, [units]);
}
