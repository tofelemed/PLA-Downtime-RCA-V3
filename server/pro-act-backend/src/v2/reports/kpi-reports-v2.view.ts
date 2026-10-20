import { formatDec } from '../../domain/actuals/decimal';
import { combine, GroupTerms, unitOf } from '../../domain/kpi/aggregate';
import { KpiMetric, KpiQuality, KpiUnit } from '../../domain/kpi/kpi.types';
import { AnalyticsResponse, ListScope } from '../common/response';
import { CalendarBasisView } from './calendar-basis-report';
import { DataCoverageView } from './data-coverage';
import { PeriodStats } from './report-sql';
import { ReportScope } from './report-scope';

/** One aggregated KPI: summed terms, the value computed from them (decimal strings), its quality. */
export interface KpiAggregateView {
  metric: KpiMetric;
  numerator: string | null;
  denominator: string | null;
  value: string | null;
  unit: KpiUnit;
  quality: KpiQuality;
  reason: string | null;
  /** stored period rows behind the value, and how many of them lacked the terms */
  rows: number;
  missing: number;
  /**
   * plan 2.3: what the figure stands on — `calculated` (stored KPI rows of calculation runs) or `calendar`
   * (computed from the stops over calendar time for units/days without a run). Set on the downtime summaries.
   */
  basis?: 'calculated' | 'calendar';
}

const dec = (value: { toFixed(): string } | null) =>
  value === null ? null : value.toFixed();

export function aggregateView(
  metric: KpiMetric,
  terms: GroupTerms | undefined,
): KpiAggregateView {
  const empty: GroupTerms = {
    numerator: null,
    denominator: null,
    minValue: null,
    rows: 0,
    complete: 0,
    provisionalRows: 0,
    policies: 0,
    reasons: [],
  };
  const result = combine(metric, terms ?? empty);
  return {
    metric,
    numerator: result.numerator === null ? null : formatDec(result.numerator),
    denominator:
      result.denominator === null ? null : formatDec(result.denominator),
    value: dec(result.value),
    unit: unitOf(metric),
    quality: result.quality,
    reason: result.reason,
    rows: result.rows,
    missing: result.missing,
  };
}

export interface ReportGroupView {
  key: string | null;
  label: string | null;
  metrics: KpiAggregateView[];
  /**
   * OEE report, period-level groups (day, shift, week, …): true when no approved plan covers any period of
   * the group ("No approved plan covers this period", owner decision 2026-10-19). Absent for product groups.
   */
  noApprovedPlan?: boolean;
}

export interface OeeReportView {
  policy: 'operational' | 'reconciled';
  /** "Operational OEE (ISO 22400)" or "Reconciled PLA OEE" */
  label: string;
  groupBy: string;
  groups: ReportGroupView[];
  total: KpiAggregateView[];
  calculationRunIds: string[];
}

export interface DowntimeGroupView {
  key: string | null;
  label: string | null;
  /** seconds (duration) or stop occurrences (frequency), decimal string */
  value: string;
  /** share of the total, 0..1 (decimal string); null when the total is 0 */
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
  /** reason subtree of the groups (drill-down), null = every reason */
  parentReasonId: string | null;
  groups: DowntimeGroupView[];
  total: string;
  /**
   * Period KPIs of the whole scope (KPI05 / KPI06: total, planned, unplanned, micro-stop and unknown time,
   * stop and carry-in count, mean completed-stop duration, scheduled availability, onstream factor),
   * independent of groupBy, metric, scheduleClass and parentReasonId
   */
  summary: KpiAggregateView[];
  /**
   * state data coverage and no-plan periods of the window (owner decision 2026-10-19: unknown state time
   * is left out of scheduled / available time and MTBF exposure)
   */
  dataCoverage: DataCoverageView;
  calculationRunIds: string[];
  /**
   * plan 2.3: units/days of the window without a calculation run, computed from the stops over calendar time
   * — a separate section, never added into `summary`
   */
  calendarBasis: CalendarBasisView;
}

/** One breakdown of a downtime bundle (same groups and total as `/reports/downtime` would answer). */
export interface DowntimeBundleItemView {
  /** the token as requested, e.g. `asset:frequency:unplanned` */
  view: string;
  groupBy: string;
  metric: 'duration' | 'frequency';
  unit: 's' | 'count';
  /** null = every schedule class */
  scheduleClass: string | null;
  groups: DowntimeGroupView[];
  total: string;
}

/** `GET /reports/downtime-bundle`: every view reads the same run selection, window and units (T24). */
export interface DowntimeBundleView {
  includeMicroStops: boolean;
  /** the schedule class the summary is for (query `scheduleClass`); null = every class */
  scheduleClass: string | null;
  /**
   * period KPIs of the whole scope, as in `/reports/downtime`; with `scheduleClass`, the figures of that class
   * (figures not split by class: null with reason `not_by_schedule_class`)
   */
  summary: KpiAggregateView[];
  /** in request order, duplicates removed */
  views: DowntimeBundleItemView[];
  /**
   * state data coverage and no-plan periods of the window (owner decision 2026-10-19: unknown state time
   * is left out of scheduled / available time and MTBF exposure)
   */
  dataCoverage: DataCoverageView;
  calculationRunIds: string[];
  /**
   * plan 2.3: units/days of the window without a calculation run, computed from the stops over calendar time
   * — a separate section, never added into `summary`
   */
  calendarBasis: CalendarBasisView;
}

export interface ReliabilityRowView {
  unitId: string;
  assetId: string | null;
  label: string | null;
  /** operating exposure (unit run time, seconds) and eligible failures behind MTBF */
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
  /**
   * state data coverage and no-plan periods of the window (owner decision 2026-10-19: unknown state time
   * is left out of scheduled / available time and MTBF exposure)
   */
  dataCoverage: DataCoverageView;
  calculationRunIds: string[];
}

export interface EnvelopeInput {
  scope: ReportScope;
  stats: PeriodStats;
  policyVersions: string[];
  provisionalData: boolean;
  notes: string[];
}

/**
 * API03 envelope of a report: the runs behind it, policy versions, coverage = share of the periods that
 * have a shown run, provisional when a draft revision or a provisional input contributes.
 */
export function reportEnvelope<T>(
  data: T,
  input: EnvelopeInput,
): AnalyticsResponse<T> {
  const { scope, stats } = input;
  const listScope: ListScope = {
    tenantId: scope.tenantId,
    unitIds: scope.unitIds,
  };
  return {
    data,
    calculationRunId: stats.runIds.length === 1 ? stats.runIds[0] : null,
    policyVersion: input.policyVersions.length
      ? input.policyVersions.join(',')
      : null,
    dataQuality: {
      missingCount: stats.periods - stats.withRun,
      provisionalCount: stats.withRun - stats.approved,
      notes: input.notes,
    },
    coverage: {
      from: scope.from.toISOString(),
      to: scope.to.toISOString(),
      ratio: stats.periods === 0 ? 0 : stats.withRun / stats.periods,
    },
    isProvisional: stats.withRun > stats.approved || input.provisionalData,
    asOf: new Date().toISOString(),
    scope: listScope,
  };
}
