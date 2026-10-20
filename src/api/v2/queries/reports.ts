import { useQuery } from '@tanstack/react-query';
import { v2Request } from '../client';
import type { QueryParams } from '../request-url';
import type { QueryOf, Schema } from '../schema-types';
import type { AnalyticsResponse } from '../types/envelopes';
import type { DowntimeReportView, OeeReportView, ReliabilityReportView } from '../types/reports';
import { sameTenantQuery } from './placeholder';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { stabilizeWindowParams } from './time-window';
import { useV2TenantId } from './use-v2-tenant';

export type ReportKind =
  | 'oee'
  | 'downtime'
  | 'reliability'
  | 'loss-value'
  | 'scope-waterfall'
  | 'loss-tree'
  | 'lines-without-event'
  | 'reconciliation-trend'
  | 'reconciliation-status'
  | 'actuals-quality'
  | 'production-by-product'
  | 'event-status'
  | 'restatements'
  | 'quality-dispositions';
export type DowntimeReportQuery = QueryOf<'/api/v2/reports/downtime', 'get'>;
export type OeeReportQuery = QueryOf<'/api/v2/reports/oee', 'get'>;
export type ReliabilityReportQuery = QueryOf<'/api/v2/reports/reliability', 'get'>;

export interface ReportQueryBase {
  from: string;
  to: string;
  unitIds?: string[];
  approvedOnly?: boolean;
}

/** Cache key of a report: chart, totals and export of one page share it (T24). */
export function reportKey(tenantId: string, kind: ReportKind, query: ReportQueryBase, tz?: string) {
  const { from, to, unitIds, approvedOnly, ...filters } = query;
  return v2Keys.list(tenantId, 'reports', {
    scope: { unitIds },
    window: { from, to, tz },
    filters: { kind, ...filters },
    revisionSelector: approvedOnly ? 'approved' : 'shown',
  });
}

/**
 * One `GET /reports/{kind}` analytics read, cached under its report key (T24); null query = idle.
 * Heavy reads: kept while filters change (previous result as placeholder), never refetched on window
 * focus (realtime notices and mutations invalidate them), window bounds minute-stable.
 */
export function useReport<TData>(kind: ReportKind, query: ReportQueryBase | null, tz?: string) {
  const tenantId = useV2TenantId();
  const enabled = Boolean(tenantId && query);
  return useQuery<AnalyticsResponse<TData>>({
    queryKey: query ? reportKey(tenantId ?? '-', kind, query, tz) : ['v2', tenantId, 'reports', 'idle'],
    enabled,
    staleTime: STALE_TIME.reports,
    refetchOnWindowFocus: false,
    placeholderData: (previous, previousQuery) => (enabled && sameTenantQuery(tenantId, previousQuery) ? previous : undefined),
    queryFn: async ({ signal }) =>
      (await v2Request<AnalyticsResponse<TData>>({
        method: 'GET',
        path: `/reports/${kind}`,
        query: stabilizeWindowParams(query ?? {}) as unknown as QueryParams,
        signal,
      })).data,
  });
}

/** Downtime report (plan 2.7) — server aggregates; the browser only renders. */
export function useDowntimeReport(query: (DowntimeReportQuery & ReportQueryBase) | null, tz?: string) {
  return useReport<DowntimeReportView>('downtime', query, tz);
}

export function useOeeReport(query: (OeeReportQuery & ReportQueryBase) | null, tz?: string) {
  return useReport<OeeReportView>('oee', query, tz);
}

export function useReliabilityReport(query: (ReliabilityReportQuery & ReportQueryBase) | null, tz?: string) {
  return useReport<ReliabilityReportView>('reliability', query, tz);
}

export type ExportRequest = Schema<'CreateExportDto'>;

export interface ReportSnapshot<TData> {
  data: TData;
  calculationRunIds: string[];
  filters: ReportQueryBase;
  /** export of exactly this snapshot, or null when it shows provisional (non-approved) content */
  exportRequest: ExportRequest | null;
}

/**
 * One snapshot for a report page (T24): the chart, the totals and the export request are all derived
 * from the same response and filters, so they carry the same `calculationRunIds` and window.
 */
export function reportSnapshot<TData extends { calculationRunIds: string[] }>(
  response: AnalyticsResponse<TData>,
  filters: ReportQueryBase,
): ReportSnapshot<TData> {
  const exportable = filters.approvedOnly === true && !response.isProvisional;
  return {
    data: response.data,
    calculationRunIds: [...response.data.calculationRunIds],
    filters,
    exportRequest: exportable
      ? {
          reportType: 'period_summary',
          format: 'csv',
          revisionSelector: 'published',
          from: filters.from,
          to: filters.to,
          unitIds: filters.unitIds,
        }
      : null,
  };
}
