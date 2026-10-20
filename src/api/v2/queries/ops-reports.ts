import { useQuery } from '@tanstack/react-query';
import { v2Request } from '../client';
import type { QueryParams } from '../request-url';
import type { QueryOf } from '../schema-types';
import type { EventStatusView, ProductionByProductView, RestatementsView } from '../types/ops-reports';
import { sameTenantQuery } from './placeholder';
import { reportKey, useReport, type ReportKind, type ReportQueryBase } from './reports';
import { STALE_TIME } from './stale-times';
import { stabilizeWindowParams } from './time-window';
import { useV2TenantId } from './use-v2-tenant';

export type ProductionByProductQuery = QueryOf<'/api/v2/reports/production-by-product', 'get'> & ReportQueryBase;

/** R1 / R11: output, quality classes and plan per product, summed on the server. */
export function useProductionByProduct(query: ProductionByProductQuery | null, tz?: string) {
  return useReport<ProductionByProductView>('production-by-product', query, tz);
}

/** A `GET /reports/{kind}` read that returns a plain view (no calculation-run envelope); null query = idle. */
function usePlainReport<TData>(kind: ReportKind, query: ReportQueryBase | null, tz?: string) {
  const tenantId = useV2TenantId();
  const enabled = Boolean(tenantId && query);
  return useQuery<TData>({
    queryKey: query ? reportKey(tenantId ?? '-', kind, query, tz) : ['v2', tenantId, 'reports', 'idle'],
    enabled,
    staleTime: STALE_TIME.reports,
    refetchOnWindowFocus: false,
    placeholderData: (previous, previousQuery) => (enabled && sameTenantQuery(tenantId, previousQuery) ? previous : undefined),
    queryFn: async ({ signal }) =>
      (await v2Request<TData>({
        method: 'GET',
        path: `/reports/${kind}`,
        query: stabilizeWindowParams(query ?? {}) as unknown as QueryParams,
        signal,
      })).data,
  });
}

/** R1 / R2 / R9: running, uncoded, coded and verified loss events of the window. */
export function useEventStatus(query: ReportQueryBase | null, tz?: string) {
  return usePlainReport<EventStatusView>('event-status', query, tz);
}

/** R3: restatements of the window's periods with finance's posting and the change in good output. */
export function useRestatements(query: ReportQueryBase | null, tz?: string) {
  return usePlainReport<RestatementsView>('restatements', query, tz);
}
