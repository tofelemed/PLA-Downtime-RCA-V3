import { Dec } from '../actuals/decimal';

/** Metrics of `kpi_results` (plan 2.7, §14.2): KPI01–KPI08. */
export const KPI_METRICS = [
  'availability',
  'performance',
  'quality',
  'oee',
  'reconciled_availability',
  'reconciled_performance',
  'reconciled_quality',
  'reconciled_oee',
  'downtime_total',
  'downtime_planned',
  'downtime_unplanned',
  'downtime_equivalent',
  'downtime_in_schedule',
  'downtime_external',
  'downtime_maintenance_overrun',
  'coded_downtime_ratio',
  'microstop_time',
  'unknown_time',
  'stop_count',
  'carry_in_count',
  'mean_stop_duration',
  'scheduled_availability',
  'onstream_factor',
  'mtbf',
  'mttr',
  'mean_downtime_to_restore',
  'coverage',
] as const;
export type KpiMetric = (typeof KPI_METRICS)[number];

/** ok; provisional (incomplete inputs); unavailable (value null with a reason); exception (> 100 %). */
export const KPI_QUALITIES = [
  'ok',
  'provisional',
  'unavailable',
  'exception',
] as const;
export type KpiQuality = (typeof KPI_QUALITIES)[number];

/** `ratio` = numerator / denominator; `s` = seconds; `count` = occurrences. */
export type KpiUnit = 'ratio' | 's' | 'count';

/** Scope levels: the period (unit), a product slice, an asset, or a downtime breakdown cell. */
export type KpiLevel = 'period' | 'slice' | 'asset' | 'breakdown';

/** Downtime breakdown dimensions (`none` = only schedule class and stop kind). */
export type BreakdownDimension =
  | 'none'
  | 'reason'
  | 'impact'
  | 'oee_component'
  | 'asset';

export type StopKind = 'availability' | 'micro';

export interface KpiScope {
  level: KpiLevel;
  sliceId?: string;
  productId?: string | null;
  assetId?: string;
  dimension?: BreakdownDimension;
  /** dimension value (code / asset id / component); null = not coded */
  key?: string | null;
  scheduleClass?: string;
  stopKind?: StopKind;
}

export type KpiCohort = Record<string, string | number | boolean | null>;

/** One computed KPI: explicit numerator and denominator; value null with a reason when not computable. */
export interface KpiDraft {
  metric: KpiMetric;
  scope: KpiScope;
  numerator: Dec | null;
  denominator: Dec | null;
  value: Dec | null;
  unit: KpiUnit;
  quality: KpiQuality;
  reason: string | null;
  cohort: KpiCohort | null;
}

/** Label of the GE-style quantity OEE (KPI04): never shown as operational OEE. */
export const RECONCILED_OEE_LABEL = 'Reconciled PLA OEE';
/** KPI08: without active-repair evidence the outage mean is not MTTR. */
export const MDTR_LABEL = 'mean downtime to restore';
