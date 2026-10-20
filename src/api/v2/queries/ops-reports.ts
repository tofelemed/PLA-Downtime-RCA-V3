import { useQuery } from '@tanstack/react-query';
import { v2Request } from '../client';
import type { QueryParams } from '../request-url';
import type { QueryOf } from '../schema-types';
import type { EventStatusView, ProductionByProductView } from '../types/ops-reports';
import { sameTenantQuery } from './placeholder';
import { reportKey, useReport, type ReportQueryBase } from './reports';
import { STALE_TIME } from './stale-times';
import { stabilizeWindowParams } from './time-window';
import { useV2TenantId } from './use-v2-tenant';

export type ProductionByProductQuery = QueryOf<'/api/v2/reports/production-by-product', 'get'> & ReportQueryBase;

/** R1 / R11: output, quality classes and plan per product, summed on the server. */
export function useProductionByProduct(query: ProductionByProductQuery | null, tz?: string) {
  return useReport<ProductionByProductView>('production-by-product', query, tz);
}

/** R1 / R2 / R9: running, uncoded, coded and verified loss events of the window (a plain view, no run envelope). */
export function useEventStatus(query: ReportQueryBase | null, tz?: string) {
  const tenantId = useV2TenantId();
  const enabled = Boolean(tenantId && query);
  return useQuery<EventStatusView>({
    queryKey: query ? reportKey(tenantId ?? '-', 'event-status', query, tz) : ['v2', tenantId, 'reports', 'idle'],
    enabled,
    staleTime: STALE_TIME.reports,
    refetchOnWindowFocus: false,
    placeholderData: (previous, previousQuery) => (enabled && sameTenantQuery(tenantId, previousQuery) ? previous : undefined),
    queryFn: async ({ signal }) =>
      (await v2Request<EventStatusView>({
        method: 'GET',
        path: '/reports/event-status',
        query: stabilizeWindowParams(query ?? {}) as unknown as QueryParams,
        signal,
      })).data,
  });
}
