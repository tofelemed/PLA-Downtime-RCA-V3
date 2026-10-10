import type { QueryOf } from '../schema-types';
import type {
  ActualsQualityView,
  LossTreeView,
  ReconciliationStatusView,
  ReconciliationTrendView,
  ScopeWaterfallView,
} from '../types/pla-analytics';
import { useReport, type ReportQueryBase } from './reports';

export type ScopeWaterfallQuery = QueryOf<'/api/v2/reports/scope-waterfall', 'get'> & ReportQueryBase;
export type LossTreeQuery = QueryOf<'/api/v2/reports/loss-tree', 'get'> & ReportQueryBase;
export type ReconciliationTrendQuery = QueryOf<'/api/v2/reports/reconciliation-trend', 'get'> & ReportQueryBase;
export type ReconciliationStatusQuery = QueryOf<'/api/v2/reports/reconciliation-status', 'get'> & ReportQueryBase;
export type ActualsQualityQuery = QueryOf<'/api/v2/reports/actuals-quality', 'get'> & ReportQueryBase;

/**
 * PLA analytics reads (plan 3.6): each a `GET /reports/{kind}` of the shared report scope, cached under
 * the same report key family as the 2.7 reports (T24); the browser renders, the server computes.
 */
export function useScopeWaterfall(query: ScopeWaterfallQuery | null, tz?: string) {
  return useReport<ScopeWaterfallView>('scope-waterfall', query, tz);
}

export function useLossTree(query: LossTreeQuery | null, tz?: string) {
  return useReport<LossTreeView>('loss-tree', query, tz);
}

export function useReconciliationTrend(query: ReconciliationTrendQuery | null, tz?: string) {
  return useReport<ReconciliationTrendView>('reconciliation-trend', query, tz);
}

export function useReconciliationStatus(query: ReconciliationStatusQuery | null, tz?: string) {
  return useReport<ReconciliationStatusView>('reconciliation-status', query, tz);
}

export function useActualsQuality(query: ActualsQualityQuery | null, tz?: string) {
  return useReport<ActualsQualityView>('actuals-quality', query, tz);
}
