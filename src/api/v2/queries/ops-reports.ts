import { useQuery } from '@tanstack/react-query';
import { v2Request } from '../client';
import type { QueryParams } from '../request-url';
import type { QueryOf } from '../schema-types';
import type {
  ChronicSporadicView,
  CodingComplianceView,
  EventStatusView,
  PlanAdherenceView,
  ProductionByProductView,
  QualityDispositionsView,
  RateLossView,
  RcaActionTrackerView,
  ReliabilityTrendView,
  RestatementsView,
  TransitionPerformanceView,
} from '../types/ops-reports';
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

/** R4: lot dispositions of the window by class, decision and product, with the pending decisions. */
export function useQualityDispositions(query: ReportQueryBase | null, tz?: string) {
  return usePlainReport<QualityDispositionsView>('quality-dispositions', query, tz);
}

/** R5: grade transitions against their standard, and per product change. */
export function useTransitionPerformance(query: ReportQueryBase | null, tz?: string) {
  return usePlainReport<TransitionPerformanceView>('transition-performance', query, tz);
}

/** R6: reliability per plant month for each unit and its most-failing assets. */
export function useReliabilityTrend(query: ReportQueryBase | null, tz?: string) {
  return useReport<ReliabilityTrendView>('reliability-trend', query, tz);
}

export type ChronicSporadicQuery = QueryOf<'/api/v2/reports/chronic-sporadic', 'get'> & ReportQueryBase;

/** R7: unplanned stops per reason or asset with their chronic / sporadic quadrant. */
export function useChronicSporadic(query: ChronicSporadicQuery | null, tz?: string) {
  return useReport<ChronicSporadicView>('chronic-sporadic', query, tz);
}

/** R8: equivalent downtime and performance per plant month. */
export function useRateLoss(query: ReportQueryBase | null, tz?: string) {
  return useReport<RateLossView>('rate-loss', query, tz);
}

/** R9: coding and verification discipline per crew and shift. */
export function useCodingCompliance(query: ReportQueryBase | null, tz?: string) {
  return useReport<CodingComplianceView>('coding-compliance', query, tz);
}

/** R10: open RCA cases and actions, closures of the window. */
export function useRcaActionTracker(query: ReportQueryBase | null, tz?: string) {
  return usePlainReport<RcaActionTrackerView>('rca-action-tracker', query, tz);
}

/** R11: plan adherence per product over the window's plant days. */
export function usePlanAdherence(query: ReportQueryBase | null, tz?: string) {
  return useReport<PlanAdherenceView>('plan-adherence', query, tz);
}
