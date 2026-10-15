import { PolicyInForce } from '../../close/workflow-policies.service';
import { ReconciliationSlaPolicy } from '../../domain/close/sla-policy';
import { PeriodSlaV2View } from '../close/period-sla.view';
import { PeriodState } from '../period-overview/period-states';
import {
  GridWorkflowState,
  planFigures,
  ResidualState,
  toPeriodSummaryView,
} from '../period-overview/period-summary.view';

/** Most overdue periods listed by the status report (the full count is `overdueCount`). */
export const OVERDUE_LIST_LIMIT = 50;

/** Age of a not yet approved period since its end, in site-independent buckets. */
export const AGE_BUCKETS = [
  { key: 'not_ended', label: 'Not ended yet', maxHours: null },
  { key: 'lt_24h', label: 'Under 24 h', maxHours: 24 },
  { key: '24h_72h', label: '24–72 h', maxHours: 72 },
  { key: '72h_7d', label: '3–7 days', maxHours: 168 },
  { key: 'gt_7d', label: 'Over 7 days', maxHours: Infinity },
] as const;

export interface OverduePeriodView {
  periodId: string;
  unitId: string;
  unitName: string | null;
  /** plan of the period's selected plan version (Plan Dashboard deep link), null without a plan */
  planId: string | null;
  localDate: string;
  shiftName: string | null;
  utcStart: string;
  utcEnd: string;
  workflowState: GridWorkflowState;
  revision: number | null;
  residualState: ResidualState | null;
  /** seconds since the period ended, at `asOf` */
  ageSeconds: number;
  /** SME R3: due time, escalation and waits of the current revision */
  sla: PeriodSlaV2View | null;
}

/** The `reconciliation_sla` version the overdue verdicts follow (SME R3). */
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
  /** periods per workflow state of the current revision (none = never calculated) */
  workflow: Array<{ state: GridWorkflowState; periods: number }>;
  /** plan-ledger residual state of the current revision (not_computable when unknown) */
  residual: Array<{ state: ResidualState; periods: number }>;
  /** age of the periods that are not approved */
  ages: Array<{ key: string; label: string; periods: number }>;
  overdueCount: number;
  /** periods not approved per escalation level reached (level ≥ 1) and the role it goes to */
  escalated: Array<{ level: number; role: string; periods: number }>;
  /** periods waiting for data (the clocks pause) */
  waitingForData: number;
  /** periods whose current revision reached the rejection escalation count (SME R6) */
  rejectionEscalated: number;
  /** oldest overdue periods first, at most `OVERDUE_LIST_LIMIT` (50); `overdueCount` is the full count */
  overdue: OverduePeriodView[];
  calculationRunIds: string[];
}

const WORKFLOW: readonly GridWorkflowState[] = [
  'none',
  'draft',
  'in_review',
  'stale',
  'approved',
];
const RESIDUAL: readonly ResidualState[] = [
  'balanced',
  'within_tolerance',
  'unaccounted',
  'over_accounted',
  'overproduction',
  'conflict',
  'not_computable',
];

/** One SQL group of the status summary: periods of a workflow state, age bucket and overdue flag. */
export interface StatusSummaryRow {
  workflow: GridWorkflowState;
  ageKey: string;
  overdue: boolean;
  escalationLevel: number;
  onHold: boolean;
  rejectionEscalated: boolean;
  periods: number;
  runIds: string[];
}

/** Plan-ledger residual state of a period's revision, the Plan Dashboard grid's rule (ACC09/ACC10). */
export function residualStateOf(state: PeriodState): ResidualState {
  if (!state.reconciliation || !state.rule) return 'not_computable';
  const plan = planFigures(state.reconciliation.slices, state.rule.epsilon);
  return plan?.residualState ?? 'not_computable';
}

/** An overdue period with its deep link target (`plans`: plan version id → plan id). */
export function overdueView(
  state: PeriodState,
  input: {
    asOf: Date;
    unitNames: Map<string, string>;
    plans: Map<string, string>;
    sla: PeriodSlaV2View | null;
  },
): OverduePeriodView {
  const view = toPeriodSummaryView(state, []);
  const version = state.period.selectedPlanVersionId;
  return {
    periodId: view.periodId,
    unitId: view.unitId,
    unitName: input.unitNames.get(view.unitId) ?? null,
    planId: version ? (input.plans.get(version) ?? null) : null,
    localDate: view.localDate,
    shiftName: view.shiftName,
    utcStart: view.utcStart,
    utcEnd: view.utcEnd,
    workflowState: view.workflowState,
    revision: view.revision?.revision ?? null,
    residualState: view.plan?.residualState ?? null,
    ageSeconds: Math.floor(
      (input.asOf.getTime() - state.period.utcEnd.getTime()) / 1000,
    ),
    sla: input.sla,
  };
}

const sumWhere = (
  rows: readonly StatusSummaryRow[],
  match: (row: StatusSummaryRow) => boolean,
) => rows.filter(match).reduce((n, row) => n + row.periods, 0);

/**
 * Reconciliation status of a scope (plan 3.6, AN02) from its SQL summary: workflow state of each period's
 * current revision (the Plan Dashboard grid's rule), the age of every period not approved since its end,
 * the overdue count and escalations by the `reconciliation_sla` policy (SME R3: past the due time of the
 * current stage, never while waiting for data) and the most overdue periods; the residual state counts
 * come from the plan 2.8 arithmetic (`residualStateOf`).
 */
export function statusView(input: {
  asOf: Date;
  sla: PolicyInForce<ReconciliationSlaPolicy>;
  summary: readonly StatusSummaryRow[];
  residual: ReadonlyMap<ResidualState, number>;
  overdue: OverduePeriodView[];
}): ReconciliationStatusView {
  const rows = input.summary;
  const open = rows.filter((r) => r.workflow !== 'approved');
  return {
    asOf: input.asOf.toISOString(),
    sla: slaPolicyView(input.sla),
    periods: sumWhere(rows, () => true),
    workflow: WORKFLOW.map((state) => ({
      state,
      periods: sumWhere(rows, (r) => r.workflow === state),
    })),
    residual: RESIDUAL.map((state) => ({
      state,
      periods: input.residual.get(state) ?? 0,
    })),
    ages: AGE_BUCKETS.map((b) => ({
      key: b.key,
      label: b.label,
      periods: sumWhere(open, (r) => r.ageKey === b.key),
    })),
    overdueCount: sumWhere(rows, (r) => r.overdue),
    escalated: input.sla.policy.escalations.map((step, i) => ({
      level: i + 1,
      role: step.role,
      periods: sumWhere(open, (r) => r.escalationLevel === i + 1),
    })),
    waitingForData: sumWhere(open, (r) => r.onHold),
    rejectionEscalated: sumWhere(open, (r) => r.rejectionEscalated),
    overdue: input.overdue,
    calculationRunIds: [...new Set(rows.flatMap((r) => r.runIds))].sort(),
  };
}

function slaPolicyView(
  sla: PolicyInForce<ReconciliationSlaPolicy>,
): StatusSlaPolicyView {
  return {
    version: sla.version,
    submitWithinHours: sla.policy.submitWithinHours,
    approveWithinHours: sla.policy.approveWithinHours,
    escalations: sla.policy.escalations.map((step, i) => ({
      level: i + 1,
      afterHours: step.afterHours,
      role: step.role,
    })),
    rejectionEscalationCount: sla.policy.rejectionEscalationCount,
  };
}
