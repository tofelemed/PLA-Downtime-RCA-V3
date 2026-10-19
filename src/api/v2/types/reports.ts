/** KPI report views (backend `src/v2/reports/kpi-reports-v2.view.ts`); every number is a decimal string. */
export interface KpiAggregateView {
  metric: string;
  numerator: string | null;
  denominator: string | null;
  value: string | null;
  unit: string;
  quality: string;
  reason: string | null;
  rows: number;
  missing: number;
}

export interface ReportGroupView {
  key: string | null;
  label: string | null;
  metrics: KpiAggregateView[];
  /** OEE report, period-level groups: no approved plan covers any period of the group (absent for products) */
  noApprovedPlan?: boolean;
}

export interface OeeReportView {
  policy: 'operational' | 'reconciled';
  label: string;
  groupBy: string;
  groups: ReportGroupView[];
  total: KpiAggregateView[];
  calculationRunIds: string[];
}

export interface DowntimeGroupView {
  key: string | null;
  label: string | null;
  /** seconds (duration) or stop count (frequency) */
  value: string;
  share: string | null;
  /** share of this group and every larger one before it (Pareto line), 0..1; null when the total is 0 */
  cumulativeShare: string | null;
  periods: number;
}

/**
 * What a window's figures stand on (owner decision 2026-10-19 "Unknown time is never available time"):
 * state data coverage (unknown state time is left out of scheduled / available time and MTBF exposure) and
 * the periods no approved plan covers.
 */
export interface DataCoverageView {
  /** shown periods with state data (0 = no state mapping: availability is not adjusted) */
  periodsWithStateData: number;
  scheduledSeconds: string | null;
  knownSeconds: string | null;
  unknownSeconds: string | null;
  /** known ÷ scheduled, 0..1; null without scheduled time */
  ratio: string | null;
  periodsWithoutPlan: number;
}

export interface DowntimeReportView {
  groupBy: string;
  metric: 'duration' | 'frequency';
  unit: 's' | 'count';
  scheduleClass: string | null;
  includeMicroStops: boolean;
  /** reason subtree of the groups (plan 3.3 drill-down), null = every reason */
  parentReasonId: string | null;
  groups: DowntimeGroupView[];
  total: string;
  /** period KPIs of the whole scope (KPI05 / KPI06), independent of groupBy, metric, class and reason */
  summary: KpiAggregateView[];
  dataCoverage?: DataCoverageView;
  calculationRunIds: string[];
}

export interface ReliabilityRowView {
  unitId: string;
  assetId: string | null;
  label: string | null;
  exposureSeconds: string | null;
  failures: string | null;
  mtbf: KpiAggregateView;
  meanDowntimeToRestore: KpiAggregateView;
  mttr: KpiAggregateView;
}

export interface ReliabilityReportView {
  units: ReliabilityRowView[];
  assets: ReliabilityRowView[];
  failureDefinition: string;
  dataCoverage?: DataCoverageView;
  calculationRunIds: string[];
}
