import { Dec, formatDec } from '../domain/actuals/decimal';
import {
  combineUncertainty,
  UncertaintyBudgetError,
  UncertaintyComponentKind,
  UncertaintyResult,
} from '../domain/uncertainty/uncertainty-budget';
import { invalid } from '../profiles/profile-errors';
import {
  StoredUncertaintyComponent,
  StoredUncertaintyCorrelation,
} from './entities/uncertainty-budget.entity';

/** The maths part of a budget as the API receives it (decimals as strings). */
export interface UncertaintyBudgetMaths {
  components: Array<{
    kind: UncertaintyComponentKind;
    label: string;
    standardUncertainty: string;
    sensitivity?: string;
  }>;
  correlations?: Array<{ a: number; b: number; coefficient: string }>;
  coverageFactor?: string;
}

/** A budget to propose: its maths, boundary and evidence. */
export interface NewUncertaintyBudget extends UncertaintyBudgetMaths {
  unitId: string;
  boundary: string;
  uom: string;
  calibrationRef: string;
  reviewDueAt: string;
  effectiveFrom: string;
  evidenceRef?: string | null;
  notes?: string | null;
}

export interface ComputedBudget {
  components: StoredUncertaintyComponent[];
  correlations: StoredUncertaintyCorrelation[];
  result: UncertaintyResult;
}

/** SME E4 default coverage factor (about 95 % for a normal distribution). */
export const DEFAULT_COVERAGE_FACTOR = '2';

/**
 * The server's computation of a budget (422 INVALID_BUDGET when inconsistent): sensitivity 1 unless
 * stated, no correlation unless stated, k = 2 unless stated. The browser never computes these numbers.
 */
export function computeBudget(input: UncertaintyBudgetMaths): ComputedBudget {
  const components = input.components.map((c) => ({
    kind: c.kind,
    label: c.label.trim(),
    standardUncertainty: formatDec(new Dec(c.standardUncertainty)),
    sensitivity: formatDec(new Dec(c.sensitivity ?? '1')),
  }));
  const correlations = (input.correlations ?? []).map((r) => ({
    a: r.a,
    b: r.b,
    coefficient: formatDec(new Dec(r.coefficient)),
  }));
  try {
    const result = combineUncertainty(
      components.map((c) => ({
        ...c,
        standardUncertainty: new Dec(c.standardUncertainty),
        sensitivity: new Dec(c.sensitivity),
      })),
      correlations.map((r) => ({ ...r, coefficient: new Dec(r.coefficient) })),
      new Dec(input.coverageFactor ?? DEFAULT_COVERAGE_FACTOR),
    );
    return { components, correlations, result };
  } catch (error: unknown) {
    if (error instanceof UncertaintyBudgetError) {
      throw invalid('INVALID_BUDGET', error.message);
    }
    throw error;
  }
}

/** Effective from before the next review (422 INVALID_RANGE). */
export function checkDates(input: {
  effectiveFrom: string;
  reviewDueAt: string;
}): { effectiveFrom: Date; reviewDueAt: Date } {
  const effectiveFrom = new Date(input.effectiveFrom);
  const reviewDueAt = new Date(input.reviewDueAt);
  if (!(reviewDueAt.getTime() > effectiveFrom.getTime())) {
    throw invalid(
      'INVALID_RANGE',
      'the next review must be after the budget takes effect',
    );
  }
  return { effectiveFrom, reviewDueAt };
}
