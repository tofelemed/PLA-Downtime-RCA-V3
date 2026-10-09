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
  calculationRunIds: string[];
}
