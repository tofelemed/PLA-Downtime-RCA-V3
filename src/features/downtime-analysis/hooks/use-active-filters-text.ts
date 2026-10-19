import { useMemo } from 'react';
import { useCrews } from '@/api/v2/queries/calendars';
import { useProducts } from '@/api/v2/queries/profiles';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { activeFilterParts } from '../model/active-filters';
import type { DowntimeFilters } from '../model/downtime-filters';

/** "Shifts: A · Schedule class: Planned" for the scope line; null when no filter narrows the figures. */
export function useActiveFiltersText(filters: DowntimeFilters): string | null {
  const products = useProducts();
  const crews = useCrews();
  return useMemo(() => {
    const productNames = new Map(flattenPages(products.data?.pages).map((p) => [p.id, `${p.code} ${p.name}`]));
    const crewNames = new Map(flattenPages(crews.data?.pages).map((c) => [c.id, c.name]));
    const parts = activeFilterParts(filters, {
      product: (id) => productNames.get(id) ?? 'Unknown product',
      crew: (id) => crewNames.get(id) ?? 'Unknown crew',
    });
    return parts.length > 0 ? parts.join(' · ') : null;
  }, [filters, products.data, crews.data]);
}
