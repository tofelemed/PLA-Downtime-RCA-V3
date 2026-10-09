import { useQuery } from '@tanstack/react-query';
import type { QueryParams } from '../request-url';
import type { QueryOf } from '../schema-types';
import type { ProductionPeriodView } from '../types/periods';
import { v2 } from '../v2';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { useV2InfiniteList } from './use-v2-list';
import { useV2TenantId } from './use-v2-tenant';

export type ProductionPeriodFilters = Omit<QueryOf<'/api/v2/production-periods', 'get'>, 'cursor'>;

/** Keyset list of production periods in a window (plan 2.4 resource), cached 30 s. */
export function useProductionPeriods(filters: ProductionPeriodFilters, tz?: string) {
  const { from, to, unitIds, ...rest } = filters;
  return useV2InfiniteList<ProductionPeriodView>({
    resource: 'production-periods',
    path: '/production-periods',
    query: filters as QueryParams,
    key: { scope: { unitIds }, window: { from, to, tz }, filters: rest },
  });
}

export function useProductionPeriod(id: string | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'production-periods', id ?? '-'),
    enabled: Boolean(tenantId && id),
    staleTime: STALE_TIME['production-periods'],
    queryFn: async ({ signal }) =>
      (await v2.get<ProductionPeriodView, '/api/v2/production-periods/{id}'>('/api/v2/production-periods/{id}', {
        path: { id: id as string },
        signal,
      })).data,
  });
}

/**
 * Accounting of one period for a ledger and revision selector (plan 2.5 read model). The body is passed
 * through untyped until 3.5 binds the Plan Dashboard grid to it.
 */
export function usePeriodAccounting(id: string | null, query: QueryOf<'/api/v2/production-periods/{id}/accounting', 'get'> = {}) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'period-accounting', id ?? '-', JSON.stringify(query)),
    enabled: Boolean(tenantId && id),
    staleTime: STALE_TIME['period-accounting'],
    queryFn: async ({ signal }) =>
      (await v2.get<Record<string, unknown>, '/api/v2/production-periods/{id}/accounting'>(
        '/api/v2/production-periods/{id}/accounting',
        { path: { id: id as string }, query, signal },
      )).data,
  });
}
