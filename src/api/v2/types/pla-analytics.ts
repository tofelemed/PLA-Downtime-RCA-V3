import type { PeriodSlaView } from './period-sla';
/**
 * PLA analytics read models (plan 3.6; backend `src/v2/pla-reports/`). Hand-written: the OpenAPI snapshot
 * describes the queries, not the response bodies. Every number is a decimal string or a server count.
 */
import type { GridWorkflowState, ResidualState, WaterfallView } from './period-overview';

export type LossTreeGroupBy = 'reason' | 'impact' | 'oee' | 'kind' | 'unit';
export type LossTreeMetric = 'qty' | 'margin' | 'standard_cost' | 'operational_cost';
export type LossTreeStatus = 'valued' | 'unvalued' | 'mixed' | 'quantity';

export interface LossTreeGroupView {
  key: string | null;
  label: string | null;
  /** unit of measure (qty) or currency (value metrics) */
  unit: string | null;
  /** null when nothing is valued or an FX rate is missing — never 0 */
  amount: string | null;
  share: string | null;
  cumulativeShare: string | null;
  lines: number;
  status: LossTreeStatus;
  reasons: string[];
}

export interface LossTreeTotalView {
  unit: string | null;
  amount: string | null;
  lines: number;
  groups: number;
  status: LossTreeStatus;
  reasons: string[];
}

export interface LossTreeView {
  groupBy: LossTreeGroupBy;
  metric: LossTreeMetric;
  ledger: 'plan' | 'capacity';
  basis: string;
  groups: LossTreeGroupView[];
  totals: LossTreeTotalView[];
  truncated: number;
  calculationRunIds: string[];
}

export type TrendGroup = 'shift' | 'day' | 'week' | 'month';

export interface ReconciliationTrendBucketView {
  key: string;
  uom: string | null;
  unaccounted: string | null;
  overAccounted: string | null;
  overproduction: string | null;
  plan: string | null;
  shortfall: string | null;
  /** SME R7: positive residual, tolerance adjustments and classified Unaccounted lines */
  unexplained: string | null;
  unexplainedOfPlan: string | null;
  /** null when nothing fell short */
  unexplainedOfShortfall: string | null;
  /** improvement target of unexplained / shortfall from the tolerance policies; null when none or mixed */
  unexplainedTarget: string | null;
  unexplainedAboveTarget: boolean | null;
  periods: number;
  excludedSlices: number;
}

export interface ReconciliationTrendView {
  groupBy: TrendGroup;
  ledger: 'plan';
  buckets: ReconciliationTrendBucketView[];
  calculationRunIds: string[];
}

export interface OverduePeriodView {
  periodId: string;
  unitId: string;
  unitName: string | null;
  planId: string | null;
  localDate: string;
  shiftName: string | null;
  utcStart: string;
  utcEnd: string;
  workflowState: GridWorkflowState;
  revision: number | null;
  residualState: ResidualState | null;
  ageSeconds: number;
  /** SME R3: due, escalation and waits of the current revision */
  sla: PeriodSlaView | null;
}

/** The reconciliation SLA policy version the overdue verdicts follow (SME R3). */
export interface StatusSlaPolicyView {
  version: number;
  submitWithinHours: number;
  approveWithinHours: number;
  escalations: Array<{ level: number; afterHours: number; role: string }>;
  rejectionEscalationCount: number;
}

export interface ReconciliationStatusView {
  asOf: string;
  sla: StatusSlaPolicyView;
  periods: number;
  workflow: Array<{ state: GridWorkflowState; periods: number }>;
  residual: Array<{ state: ResidualState; periods: number }>;
  ages: Array<{ key: string; label: string; periods: number }>;
  overdueCount: number;
  escalated: Array<{ level: number; role: string; periods: number }>;
  waitingForData: number;
  rejectionEscalated: number;
  overdue: OverduePeriodView[];
  calculationRunIds: string[];
}

export interface ActualsQualityView {
  periods: number;
  slices: number;
  periodsWithoutActuals: number;
  qualityStates: Array<{ state: string; slices: number }>;
  coverage: Array<{ key: string; label: string; slices: number }>;
  lowestCoverage: string | null;
  quantities: Array<{ uom: string | null; measured: string; estimated: string }>;
  calculationRunIds: string[];
}

/** `GET /reports/scope-waterfall`: the 3.5 waterfall of every period of a window and units. */
export type ScopeWaterfallView = Omit<WaterfallView, 'view'> & { view: 'approved' | 'shown' };
