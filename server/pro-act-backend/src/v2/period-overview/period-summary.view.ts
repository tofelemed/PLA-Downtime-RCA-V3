import { Dec, formatDec, ZERO } from '../../domain/actuals/decimal';
import { SliceReconciliation } from '../../domain/reconciliation/reconciliation.types';
import { PeriodSlaV2View } from '../close/period-sla.view';
import { PeriodState } from './period-states';

/** Workflow state of the shown revision (WF01); `stale` = in review with changed inputs. */
export type GridWorkflowState =
  | 'none'
  | 'draft'
  | 'in_review'
  | 'stale'
  | 'approved';

/**
 * How the period's plan residual reads (ACC09/ACC10): `balanced` within the comparison epsilon,
 * `within_tolerance` within the policy tolerance, else unaccounted / over-accounted, overproduction (T17)
 * and `conflict` (attributed loss on an overproducing period); `not_computable` without target or actual.
 */
export type ResidualState =
  | 'not_computable'
  | 'balanced'
  | 'within_tolerance'
  | 'unaccounted'
  | 'over_accounted'
  | 'overproduction'
  | 'conflict';

/** Plan-ledger figures of the period: the slices summed when they share one unit (decimal strings). */
export interface PeriodPlanFiguresV2View {
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

export interface PeriodSummaryV2View {
  periodId: string;
  unitId: string;
  /** UX D-6: plan of the period's selected plan version (rows of several plans in one list), null without one */
  planId: string | null;
  utcStart: string;
  utcEnd: string;
  localDate: string;
  shiftName: string | null;
  isExcluded: boolean;
  exclusionKind: string | null;
  /** display readiness (open / reconciled) — not the workflow state (WF01) */
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
  run: {
    id: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
  } | null;
  plan: PeriodPlanFiguresV2View | null;
  /** lowest actuals coverage ratio of the slices (decimal string), null without actuals */
  coverageRatio: string | null;
  /** distinct actuals quality states of the slices (complete, partial, missing, …) */
  qualityStates: string[];
  productIds: string[];
  /** SME R3 / R6: due, overdue and escalation of the period's current revision (server clock) */
  sla: PeriodSlaV2View | null;
}

const text = (value: Dec | null) => (value === null ? null : formatDec(value));

function sumNullable(values: readonly (Dec | null)[]): Dec | null {
  if (values.some((v) => v === null)) return null;
  return (values as Dec[]).reduce((a, b) => a.plus(b), ZERO);
}

function residualStateOf(
  f: {
    residual: Dec | null;
    overproduction: Dec | null;
    attributed: Dec;
    tolerance: Dec;
  },
  epsilon: Dec,
): ResidualState {
  if (f.residual === null) return 'not_computable';
  if (f.overproduction && f.overproduction.gt(epsilon))
    return f.attributed.gt(epsilon) ? 'conflict' : 'overproduction';
  const size = f.residual.abs();
  if (size.lte(epsilon)) return 'balanced';
  if (size.lte(f.tolerance)) return 'within_tolerance';
  return f.residual.gt(ZERO) ? 'unaccounted' : 'over_accounted';
}

/** Sums the slices of a period; different units of measure are never added (`uom_mixed`). */
export function planFigures(
  slices: readonly SliceReconciliation[],
  epsilon: Dec,
): PeriodPlanFiguresV2View | null {
  if (!slices.length) return null;
  const uoms = [...new Set(slices.map((s) => s.uom))];
  const flags = [...new Set(slices.flatMap((s) => s.flags))].sort();
  if (uoms.length > 1) {
    return {
      uom: null,
      target: null,
      actual: null,
      gap: null,
      attributed: null,
      toleranceAdjustment: null,
      residual: null,
      overAccounted: null,
      overproduction: null,
      tolerance: null,
      residualState: 'not_computable',
      flags: [...flags, 'uom_mixed'],
    };
  }
  const sum = (pick: (s: SliceReconciliation) => Dec | null) =>
    sumNullable(slices.map(pick));
  const attributed = sum((s) => s.attributed) as Dec;
  const tolerance = sum((s) => s.tolerance) as Dec;
  const residual = sum((s) => s.residual);
  const overproduction = sum((s) => s.overproduction);
  return {
    uom: uoms[0],
    target: text(sum((s) => s.target)),
    actual: text(sum((s) => s.actual)),
    gap: text(sum((s) => s.gap)),
    attributed: text(attributed),
    toleranceAdjustment: text(sum((s) => s.toleranceAdjustment)),
    residual: text(residual),
    overAccounted: text(sum((s) => s.overAccounted)),
    overproduction: text(overproduction),
    tolerance: text(tolerance),
    residualState: residualStateOf(
      { residual, overproduction, attributed, tolerance },
      epsilon,
    ),
    flags,
  };
}

function workflowOf(state: PeriodState): GridWorkflowState {
  const revision = state.revision;
  if (!revision) return 'none';
  if (revision.lifecycle === 'in_review' && revision.isStale) return 'stale';
  return revision.lifecycle as GridWorkflowState;
}

function coverageOf(state: PeriodState): string | null {
  const ratios = state.actuals.map((a) =>
    a.coverageRatio === null ? ZERO : new Dec(a.coverageRatio),
  );
  if (!ratios.length) return null;
  return formatDec(ratios.reduce((a, b) => (b.lt(a) ? b : a)));
}

export function toPeriodSummaryView(
  state: PeriodState,
  productIds: string[],
  sla: PeriodSlaV2View | null = null,
  planId: string | null = null,
): PeriodSummaryV2View {
  const { period, revision, run } = state;
  return {
    periodId: period.id,
    unitId: period.unitId,
    planId,
    utcStart: period.utcStart.toISOString(),
    utcEnd: period.utcEnd.toISOString(),
    localDate: period.localDate,
    shiftName: period.shiftName,
    isExcluded: period.isExcluded,
    exclusionKind: period.exclusionKind,
    stateReadiness: period.stateReadiness,
    workflowState: workflowOf(state),
    revision: revision
      ? {
          id: revision.id,
          revision: revision.revision,
          lifecycle: revision.lifecycle,
          isStale: revision.isStale,
          staleReason: revision.staleReason,
          submittedBy: revision.submittedBy,
          submittedAt: revision.submittedAt
            ? revision.submittedAt.toISOString()
            : null,
        }
      : null,
    publishedRevision: state.publishedRevision,
    run: run
      ? {
          id: run.id,
          status: run.status,
          startedAt: run.startedAt.toISOString(),
          completedAt: run.completedAt ? run.completedAt.toISOString() : null,
        }
      : null,
    plan:
      state.reconciliation && state.rule
        ? planFigures(state.reconciliation.slices, state.rule.epsilon)
        : null,
    coverageRatio: coverageOf(state),
    qualityStates: [
      ...new Set(state.actuals.map((a) => a.qualityState)),
    ].sort(),
    productIds,
    sla,
  };
}
