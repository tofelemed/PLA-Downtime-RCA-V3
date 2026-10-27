import type { LossBasis } from './loss-accounting';
import type { PeriodSlaView } from './period-sla';
/**
 * Plan Dashboard read models (plan 3.5): the period grid (`GET /period-summaries`), the ledger waterfall
 * (`GET /reports/waterfall`), the period accounting (`GET /production-periods/{id}/accounting`, plan 2.5/2.6),
 * the loss-value report (plan 2.6) and export jobs (plan 2.9). Backend views in `src/v2/period-overview/`,
 * `src/v2/accounting/`, `src/v2/reports/loss-value-report.ts`, `src/v2/exports/export-v2.view.ts`.
 */
export type GridWorkflowState = 'none' | 'draft' | 'in_review' | 'stale' | 'approved';

export type ResidualState =
  | 'not_computable'
  | 'balanced'
  | 'within_tolerance'
  | 'unaccounted'
  | 'over_accounted'
  | 'overproduction'
  | 'conflict';

export interface PeriodPlanFiguresView {
  uom: string | null;
  target: string | null;
  actual: string | null;
  gap: string | null;
  attributed: string | null;
  toleranceAdjustment: string | null;
  residual: string | null;
  overAccounted: string | null;
  overproduction: string | null;
  tolerance: string | null;
  residualState: ResidualState;
  flags: string[];
}

export interface PeriodSummaryView {
  periodId: string;
  /** plan of the selected plan version (U3: one list spans every plan of the scope) */
  planId?: string | null;
  unitId: string;
  utcStart: string;
  utcEnd: string;
  localDate: string;
  shiftName: string | null;
  /** the period spans its whole operational day (daily accounting grain), else a shift */
  isDayGrain: boolean;
  /** loss basis the period's current run was calculated with; null = no run yet (read the policy in force) */
  lossBasis: LossBasis | null;
  isExcluded: boolean;
  exclusionKind: string | null;
  stateReadiness: string;
  workflowState: GridWorkflowState;
  revision: {
    id: string;
    revision: number;
    lifecycle: string;
    isStale: boolean;
    staleReason: string | null;
    submittedBy: string | null;
    submittedAt: string | null;
  } | null;
  publishedRevision: number | null;
  run: { id: string; status: string; startedAt: string; completedAt: string | null } | null;
  plan: PeriodPlanFiguresView | null;
  coverageRatio: string | null;
  qualityStates: string[];
  productIds: string[];
  /** SME R3 / R6: due, overdue and escalation of the current revision (server clock) */
  sla: PeriodSlaView | null;
}

export type LedgerKind = 'plan' | 'capacity';
export type RevisionSelector = 'current' | 'approved';

export interface WaterfallBarView {
  key: string;
  label: string;
  kind: 'total' | 'step';
  delta: string | null;
  start: string;
  end: string;
}

export interface WaterfallView {
  ledger: LedgerKind;
  view: RevisionSelector;
  uom: string | null;
  periodIds: string[];
  calculationRunIds: string[];
  bars: WaterfallBarView[];
  opening: string | null;
  closing: string | null;
  closes: boolean;
  isProvisional: boolean;
  excluded: Array<{ periodId: string; sliceId: string | null; reason: string }>;
  /** LA-08, plan ledger: transition time within the standard the plan targets already allow for (information, not a step) */
  plannedTransition: string | null;
}

export interface LedgerTotalsView {
  sliceId: string;
  ledger: LedgerKind;
  uom: string | null;
  capacity: string | null;
  exclusion: string | null;
  availability: string | null;
  performance: string | null;
  quality: string | null;
  good: string | null;
  gain: string | null;
  attributed: string | null;
  residual: string | null;
  target: string | null;
  actual: string | null;
  gap: string | null;
  overproduction: string | null;
  overAccounted: string | null;
  /** LA-08: plan ledger, transition allowance the target already allows for (information) */
  plannedTransition: string | null;
  flags: string[];
}

export interface PolicyVersionRef {
  kind: string;
  id: string;
  version: number;
}

export interface PeriodAccountingView {
  periodId: string;
  unitId: string;
  utcStart: string;
  utcEnd: string;
  defaultLedgerView: string | null;
  revision: { id: string; revision: number; lifecycle: string; currentRunId: string | null } | null;
  run: {
    id: string;
    status: string;
    trigger: string;
    engineVersion: string;
    policyVersions: PolicyVersionRef[];
    inputHash: string;
    actualsRunId: string | null;
    startedAt: string;
    completedAt: string | null;
  } | null;
  totals: LedgerTotalsView[];
  coverageRatio: number | null;
}

export interface CurrencyValueView {
  currency: string;
  amount: string | null;
  nativeAmount: string;
  status: 'valued' | 'unvalued' | 'mixed';
  reasons: string[];
}

export interface LossValueGroupView {
  key: string;
  currencies: CurrencyValueView[];
  unvalued: Array<{ uom: string | null; quantity: string; seconds: string }>;
}

export interface LossValueReportView {
  metric: string;
  view: string;
  label: string;
  /** SME V8: the policy's default management view was used (no metric asked) */
  defaultView: boolean;
  /** SME V8 / R12: approved only when every shown period is approved */
  valuationStatus: 'approved' | 'provisional';
  approvedPeriods: number;
  periods: number;
  ledger: LedgerKind;
  groupBy: string;
  basis: string;
  groups: LossValueGroupView[];
  total: LossValueGroupView;
  /** VA-04, `groupBy=component` only: the economic view by component (else null; `groups` is then empty) */
  components?: EconomicComponentGroupView[] | null;
  calculationRunIds: string[];
}

/** One economic component in one reporting currency (server `loss-value-components.ts`). */
export interface EconomicComponentValueView {
  currency: string;
  /** decimal string; null when unvalued or a line lacks an approved FX rate (never estimated) */
  amount: string | null;
  status: 'valued' | 'unvalued' | 'mixed';
  fxProvisional: boolean;
  reasons: string[];
  lines: number;
}

/** A part of the economic view (`lost_contribution`, `rework_cost`, …, `not_broken_down`, `unvalued`). */
export interface EconomicComponentGroupView {
  key: string;
  currencies: EconomicComponentValueView[];
  quantities: Array<{ uom: string | null; quantity: string }>;
}

export interface ExportJobDetailView {
  id: string;
  reportType: string;
  format: string;
  revisionSelector: string;
  state: string;
  rowCount: number | null;
  sizeBytes: number | null;
  contentHash: string | null;
  requestedAt: string;
  finishedAt: string | null;
  expiresAt: string | null;
  downloadUrl: string | null;
  error: { code: string; message: string | null } | null;
}
