import type { QueryOf } from '../schema-types';
import type {
  ActualsQualityView,
  LinesWithoutEventView,
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

/** The loss tree by cause event (`groupBy=event`): the attributed quantity of each event in the scope (QA PLA M2). */
export type EventLossQuery = ReportQueryBase & { groupBy: 'event'; metric: 'qty'; ledger: 'plan' | 'capacity' };

export function useEventLosses(query: EventLossQuery | null, tz?: string) {
  return useReport<LossTreeView>('loss-tree', query, tz);
}

/** The scope's loss lines that explain no event, of some loss kinds (QA PLA M3 re-test: a drill with no event). */
export type LinesWithoutEventQuery = ReportQueryBase & { ledger: 'plan' | 'capacity'; kinds: string[] };

export function useLinesWithoutEvent(query: LinesWithoutEventQuery | null, tz?: string) {
  return useReport<LinesWithoutEventView>('lines-without-event', query, tz);
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
