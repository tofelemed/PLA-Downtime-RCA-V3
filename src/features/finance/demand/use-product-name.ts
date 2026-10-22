import { useProducts } from '@/api/v2/queries/profiles';

/** The name of a plant product by id ("—" while unknown), from the shared products query. */
export function useProductName(): (id: string) => string {
  const products = useProducts();
  return (id) => products.data?.pages.flatMap((page) => page.items).find((product) => product.id === id)?.name ?? '—';
}
