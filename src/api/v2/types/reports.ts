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
  periods: number;
}

export interface DowntimeReportView {
  groupBy: string;
  metric: 'duration' | 'frequency';
  unit: 's' | 'count';
  scheduleClass: string | null;
  includeMicroStops: boolean;
  groups: DowntimeGroupView[];
  total: string;
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
