import { useMemo } from 'react';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { useUnits } from '@/api/v2/queries/units';
import { useNameResolver, type NameResolver } from './name-resolver';

/** Unit names from the cached v2 unit list (`useUnits`, shared with the pickers); fallback "Unknown unit". */
export function useUnitNames(): NameResolver {
  const query = useUnits();
  const units = useMemo(() => flattenPages(query.data?.pages), [query.data]);
  return useNameResolver(units, query.isLoading, 'Unknown unit');
}
