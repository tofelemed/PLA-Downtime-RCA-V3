import { useQuery } from '@tanstack/react-query';
import type { QueryParams } from '../request-url';
import type { ProductView } from '../types/plans';
import type { ProfileView, RateImportView, RateView, ValuationRateView, VersionState } from '../types/profiles';
import { v2 } from '../v2';
import { v2Keys } from './query-keys';
import { useV2InfiniteList } from './use-v2-list';
import { useV2TenantId } from './use-v2-tenant';

/** Products of the tenant (plan 3.4 pickers; master data, fresh for 5 minutes). */
export function useProducts() {
  return useV2InfiniteList<ProductView>({ resource: 'products', path: '/products', query: { limit: 500 }, key: {} });
}

export interface ProfileFilters {
  unitId?: string;
  productId?: string;
  state?: VersionState;
}

const defined = (filters: object): QueryParams =>
  Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== '')) as QueryParams;

/** Profile versions (unit × product × mode), filtered on the server. */
export function useProfiles(filters: ProfileFilters) {
  const query = defined(filters);
  return useV2InfiniteList<ProfileView>({
    resource: 'profiles',
    path: '/profiles',
    query: { ...query, limit: 200 },
    key: { scope: filters.unitId ? { unitIds: [filters.unitId] } : null, filters: { kind: 'profiles', ...query } },
  });
}

/** Rate versions of one profile, every kind (the table groups them by kind). */
export function useProfileRates(profileId: string | null) {
  return useV2InfiniteList<RateView>({
    resource: 'profiles',
    path: `/profiles/${profileId ?? '-'}/rates`,
    query: { limit: 500 },
    key: { filters: { kind: 'rates', profileId } },
    enabled: profileId !== null,
  });
}

/** Valuation rate versions owned by one profile (margin / standard cost per quantity). */
export function useValuationRates(profileId: string | null) {
  return useV2InfiniteList<ValuationRateView>({
    resource: 'profiles',
    path: '/valuation-rates',
    query: { profileId: profileId ?? undefined, limit: 500 },
    key: { filters: { kind: 'valuation-rates', profileId } },
    enabled: profileId !== null,
  });
}

const RUNNING_IMPORT = 'queued';

/** Status of a rate import (202 job), polled every 2 s until it is no longer queued. */
export function useRateImportJob(importId: string | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'jobs', importId ?? '-', 'rate-import'),
    enabled: Boolean(tenantId && importId),
    queryFn: async ({ signal }) =>
      (await v2.get<RateImportView, '/api/v2/rate-imports/{id}'>('/api/v2/rate-imports/{id}', { path: { id: importId as string }, signal })).data,
    refetchInterval: (query) => (query.state.data && query.state.data.state !== RUNNING_IMPORT ? false : 2000),
  });
}
