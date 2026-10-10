import { PeriodState } from '../period-overview/period-states';
import {
  GridWorkflowState,
  PeriodSummaryV2View,
  ResidualState,
  toPeriodSummaryView,
} from '../period-overview/period-summary.view';

const HOUR_S = 3600;

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
}

export interface ReconciliationStatusView {
  asOf: string;
  overdueAfterHours: number;
  periods: number;
  /** periods per workflow state of the current revision (none = never calculated) */
  workflow: Array<{ state: GridWorkflowState; periods: number }>;
  /** plan-ledger residual state of the current revision (not_computable when unknown) */
  residual: Array<{ state: ResidualState; periods: number }>;
  /** age of the periods that are not approved */
  ages: Array<{ key: string; label: string; periods: number }>;
  overdueCount: number;
  /** oldest overdue periods first, at most 50 */
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

const countBy = <K extends string>(keys: readonly K[], values: readonly K[]) =>
  keys.map((key) => ({
    state: key,
    periods: values.filter((v) => v === key).length,
  }));

function ageKey(ageSeconds: number): string {
  if (ageSeconds < 0) return 'not_ended';
  const hours = ageSeconds / HOUR_S;
  const bucket = AGE_BUCKETS.find(
    (b) => b.maxHours !== null && hours < b.maxHours,
  );
  return bucket?.key ?? 'gt_7d';
}

interface StatusRow {
  view: PeriodSummaryV2View;
  ageSeconds: number;
  planId: string | null;
}

function overdueView(
  { view, ageSeconds, planId }: StatusRow,
  unitNames: Map<string, string>,
): OverduePeriodView {
  return {
    periodId: view.periodId,
    unitId: view.unitId,
    unitName: unitNames.get(view.unitId) ?? null,
    planId,
    localDate: view.localDate,
    shiftName: view.shiftName,
    utcStart: view.utcStart,
    utcEnd: view.utcEnd,
    workflowState: view.workflowState,
    revision: view.revision?.revision ?? null,
    residualState: view.plan?.residualState ?? null,
    ageSeconds,
  };
}

/**
 * Reconciliation status of a scope (plan 3.6, AN02): workflow state and residual state of each period's
 * current revision (the Plan Dashboard grid's rule), the age of every period not approved since its end,
 * and the overdue periods (not approved `overdueAfterHours` after their end) with a deep link target.
 */
export function reconciliationStatus(
  states: readonly PeriodState[],
  input: {
    asOf: Date;
    overdueAfterHours: number;
    unitNames: Map<string, string>;
    /** plan version id → plan id */
    plans: Map<string, string>;
  },
): ReconciliationStatusView {
  const rows = states.map((state): StatusRow => {
    const view = toPeriodSummaryView(state, []);
    const ageSeconds = Math.floor(
      (input.asOf.getTime() - state.period.utcEnd.getTime()) / 1000,
    );
    const version = state.period.selectedPlanVersionId;
    const planId = version ? (input.plans.get(version) ?? null) : null;
    return { view, ageSeconds, planId };
  });
  const open = rows.filter((r) => r.view.workflowState !== 'approved');
  const overdue = open
    .filter((r) => r.ageSeconds >= input.overdueAfterHours * HOUR_S)
    .sort((a, b) => b.ageSeconds - a.ageSeconds);
  return {
    asOf: input.asOf.toISOString(),
    overdueAfterHours: input.overdueAfterHours,
    periods: rows.length,
    workflow: countBy(
      WORKFLOW,
      rows.map((r) => r.view.workflowState),
    ),
    residual: countBy(
      RESIDUAL,
      rows.map((r) => r.view.plan?.residualState ?? 'not_computable'),
    ),
    ages: AGE_BUCKETS.map((b) => ({
      key: b.key,
      label: b.label,
      periods: open.filter((r) => ageKey(r.ageSeconds) === b.key).length,
    })),
    overdueCount: overdue.length,
    overdue: overdue
      .slice(0, 50)
      .map((row) => overdueView(row, input.unitNames)),
    calculationRunIds: [
      ...new Set(states.flatMap((s) => (s.run ? [s.run.id] : []))),
    ].sort(),
  };
}
