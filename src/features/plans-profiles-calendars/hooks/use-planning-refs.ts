import { useMemo } from 'react';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { useUnits } from '@/api/v2/queries/units';
import { useProducts } from '@/api/v2/queries/profiles';
import { useSites } from '@/api/v2/queries/reference-data';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import type { Option } from '../components/native-select';

export interface PlanningRefs {
  timezone: string;
  timezoneIsFallback: boolean;
  unitOptions: Option[];
  productOptions: Option[];
  siteOptions: Option[];
  defaultSiteId: string | null;
  unitName: (id: string | null | undefined) => string;
  productName: (id: string | null | undefined) => string;
  loading: boolean;
}

const nameOf = (map: Map<string, string>) => (id: string | null | undefined) => (id ? (map.get(id) ?? id.slice(0, 8)) : '—');

/** Units, products and sites of the caller's scope with display names, plus the plant timezone (D03). */
export function usePlanningRefs(): PlanningRefs {
  const units = useUnits();
  const products = useProducts();
  const sites = useSites();
  const zone = usePlantTimezone();
  return useMemo(() => {
    const unitList = flattenPages(units.data?.pages);
    const productList = flattenPages(products.data?.pages);
    const siteList = sites.data?.items ?? [];
    const unitOptions = unitList.map((unit) => ({ value: unit.id, label: unit.name }));
    const productOptions = productList.map((product) => ({ value: product.id, label: `${product.name} (${product.code})` }));
    return {
      timezone: zone.timezone,
      timezoneIsFallback: zone.source === 'utc-fallback',
      unitOptions,
      productOptions,
      siteOptions: siteList.map((site) => ({ value: site.id, label: `${site.name} · ${site.timezone}` })),
      defaultSiteId: (siteList.find((site) => site.isDefault) ?? siteList[0])?.id ?? null,
      unitName: nameOf(new Map(unitOptions.map((o) => [o.value, o.label]))),
      productName: nameOf(new Map(productList.map((p) => [p.id, p.name]))),
      loading: units.isLoading || products.isLoading || sites.isLoading || zone.loading,
    };
  }, [units.data, products.data, sites.data, zone.timezone, zone.source, zone.loading, units.isLoading, products.isLoading, sites.isLoading]);
}
