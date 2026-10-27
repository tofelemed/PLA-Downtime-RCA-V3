import { useMemo } from 'react';
import { useUnits } from '@/api/v2/queries/units';
import { flattenPages } from '@/api/v2/queries/use-v2-list';

/** Unit name by id (the units list is cached by the query layer); undefined while unknown. */
export function useUnitNames(): (id: string | null | undefined) => string | undefined {
  const units = useUnits();
  const pages = units.data?.pages;
  const byId = useMemo(() => new Map(flattenPages(pages).map((unit) => [unit.id, unit.name])), [pages]);
  return (id) => (id ? byId.get(id) : undefined);
}
