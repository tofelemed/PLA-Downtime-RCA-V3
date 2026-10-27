import { Dec, formatDec, ZERO } from '../../domain/actuals/decimal';
import { LossKind } from '../../domain/accounting/accounting.types';
import { sumOf } from '../../domain/accounting/claims';
import { ownQuantity } from '../../domain/reconciliation/reconcile';
import {
  Candidate,
  DecisionLine,
  Reconciliation,
  SliceReconciliation,
} from '../../domain/reconciliation/reconciliation.types';

export type StatementRevisionState = 'approved' | 'provisional';

/** The figures of the loss accounting statement (Task 13), in statement order. */
export const STATEMENT_FIGURES = [
  'planned',
  'actual',
  'shortfall',
  'availability',
  'performance',
  'quality',
  'transitionExcess',
  'unaccountedClassified',
  'grossAttributed',
  'recovery',
  'netAccounted',
  'toleranceAdjustment',
  'unaccounted',
] as const;
export type StatementFigure = (typeof STATEMENT_FIGURES)[number];

export type StatementFigures = Record<StatementFigure, Dec | null>;

/**
 * The loss accounting statement of a period, a day or a window (owner requirement, 27 Oct 2026), decimal
 * strings: `shortfall = netAccounted + toleranceAdjustment + unaccounted`, `netAccounted = grossAttributed
 * − recovery`, `grossAttributed = availability + performance + quality + transitionExcess +
 * unaccountedClassified`. Every figure is computed here (server); the browser only renders it.
 */
export interface LossStatementView {
  /** planned production (plan-ledger target) */
  planned: string | null;
  /** actual good production */
  actual: string | null;
  /** production shortfall = planned − actual (signed, never clamped) */
  shortfall: string | null;
  /** equipment downtime loss */
  availability: string;
  /** reduced throughput loss */
  performance: string;
  quality: string;
  /** transition loss beyond (or without) the standard, and transition allowances kept in the plan ledger */
  transitionExcess: string;
  /** loss classified as Unaccounted (a label, no cause proof) */
  unaccountedClassified: string;
  /** Σ every loss kind (all but the recovery) */
  grossAttributed: string;
  /** verified recovery (gain), a positive figure shown with a minus sign */
  recovery: string;
  /** false while a declared recovery share's event coding is not verified by a supervisor */
  recoveryVerified: boolean;
  /** net accounted loss = grossAttributed − recovery */
  netAccounted: string;
  /** tolerance adjustments and bridge lines of the reconciliation */
  toleranceAdjustment: string;
  /** unaccounted loss = shortfall − netAccounted − toleranceAdjustment (signed) */
  unaccounted: string | null;
  uom: string | null;
  revisionState: StatementRevisionState;
}

/** Amount of one kind of the run's plan lines the reconciliation does not decide (gain, transitions, classified). */
export interface KindAmount {
  kind: LossKind;
  quantity: Dec;
}

/** What the statement of one period is computed from: its shown revision, reconciled (plan 2.8), and run. */
export interface StatementSource {
  candidates: readonly Candidate[];
  lines: readonly DecisionLine[];
  reconciliation: Reconciliation;
  /** Σ of the run's automatic plan lines that are not reconciliation candidates, by kind */
  runLines: readonly KindAmount[];
  recoveryVerified: boolean;
  revisionState: StatementRevisionState;
}

/** A period's statement before formatting: figures and what decides its markers. */
export interface PeriodStatement {
  figures: StatementFigures;
  uom: string | null;
  recoveryVerified: boolean;
  revisionState: StatementRevisionState;
}

const TRANSITION_KINDS: ReadonlySet<string> = new Set([
  'transition_excess',
  'transition_allowance',
]);

/** Σ quantity by line kind: candidates as decided, lines that add their own quantity, the run's other lines. */
function kindTotals(source: StatementSource): Map<string, Dec> {
  const totals = new Map<string, Dec>();
  const add = (kind: string | null, quantity: Dec) => {
    if (!kind) return;
    totals.set(kind, (totals.get(kind) ?? ZERO).plus(quantity));
  };
  const byKey = new Map(source.candidates.map((c) => [c.autoKey, c]));
  for (const outcome of source.reconciliation.candidates) {
    add(byKey.get(outcome.autoKey)?.kind ?? null, outcome.effectiveQuantity);
  }
  for (const line of source.lines) add(line.kind, ownQuantity(line, byKey));
  for (const line of source.runLines) add(line.kind, line.quantity);
  return totals;
}

/** Σ of a slice figure; null when any slice lacks it (a partial plan is never shown as a whole one). */
function sliceSum(
  slices: readonly SliceReconciliation[],
  pick: (slice: SliceReconciliation) => Dec | null,
): Dec | null {
  if (slices.length === 0) return null;
  const values = slices.map(pick);
  return values.some((v) => v === null) ? null : sumOf(values as Dec[]);
}

/** The statement of one period from its reconciled revision (Task 13 identity, every sum server-side). */
export function periodStatement(source: StatementSource): PeriodStatement {
  const { slices } = source.reconciliation;
  const kinds = kindTotals(source);
  const kind = (name: string) => kinds.get(name) ?? ZERO;
  const transition = sumOf(
    [...kinds].filter(([k]) => TRANSITION_KINDS.has(k)).map(([, q]) => q),
  );
  const losses = ['availability', 'performance', 'quality'].map(kind);
  const gross = sumOf([...losses, transition, kind('unaccounted_classified')]);
  const recovery = ZERO.minus(kind('gain'));
  const net = gross.minus(recovery);
  const adjustment = sumOf(slices.map((s) => s.toleranceAdjustment)).plus(
    kind('bridge'),
  );
  const shortfall = sliceSum(slices, (s) => s.gap);
  return {
    figures: {
      planned: sliceSum(slices, (s) => s.target),
      actual: sliceSum(slices, (s) => s.actual),
      shortfall,
      availability: losses[0],
      performance: losses[1],
      quality: losses[2],
      transitionExcess: transition,
      unaccountedClassified: kind('unaccounted_classified'),
      grossAttributed: gross,
      recovery,
      netAccounted: net,
      toleranceAdjustment: adjustment,
      unaccounted: shortfall ? shortfall.minus(net).minus(adjustment) : null,
    },
    uom: slices[0]?.uom ?? null,
    recoveryVerified: source.recoveryVerified,
    revisionState: source.revisionState,
  };
}

const fmt = (value: Dec | null) => (value === null ? null : formatDec(value));
const fmtZero = (value: Dec | null) => formatDec(value ?? ZERO);

/** The statement as the API sends it (decimal strings). */
export function statementView(statement: PeriodStatement): LossStatementView {
  const f = statement.figures;
  return {
    planned: fmt(f.planned),
    actual: fmt(f.actual),
    shortfall: fmt(f.shortfall),
    availability: fmtZero(f.availability),
    performance: fmtZero(f.performance),
    quality: fmtZero(f.quality),
    transitionExcess: fmtZero(f.transitionExcess),
    unaccountedClassified: fmtZero(f.unaccountedClassified),
    grossAttributed: fmtZero(f.grossAttributed),
    recovery: fmtZero(f.recovery),
    recoveryVerified: statement.recoveryVerified,
    netAccounted: fmtZero(f.netAccounted),
    toleranceAdjustment: fmtZero(f.toleranceAdjustment),
    unaccounted: fmt(f.unaccounted),
    uom: statement.uom,
    revisionState: statement.revisionState,
  };
}
