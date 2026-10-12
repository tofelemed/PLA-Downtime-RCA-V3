import { useMemo } from 'react';
import { useProducts } from '@/api/v2/queries/profiles';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { useNameResolver, type NameResolver } from './name-resolver';

/** Product names from the cached v2 product list (`useProducts`); fallback "Unknown product". */
export function useProductNames(): NameResolver {
  const query = useProducts();
  const products = useMemo(() => flattenPages(query.data?.pages), [query.data]);
  return useNameResolver(products, query.isLoading, 'Unknown product');
}
