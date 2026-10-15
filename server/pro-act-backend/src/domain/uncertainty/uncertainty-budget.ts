import { Dec, formatDec, ZERO } from '../actuals/decimal';

/** SME E4 budget components of a reconciliation at one measurement boundary. */
export const UNCERTAINTY_COMPONENT_KINDS = [
  'meter',
  'scale',
  'inventory',
  'conversion',
  'timing',
] as const;
export type UncertaintyComponentKind =
  (typeof UNCERTAINTY_COMPONENT_KINDS)[number];

/**
 * One input quantity: its standard uncertainty `u` (one standard deviation, in the budget's unit) and the
 * sensitivity coefficient `c` of the reconciled quantity to it (1 for a sum, −1 for a subtracted reading).
 */
export interface UncertaintyComponent {
  kind: UncertaintyComponentKind;
  label: string;
  standardUncertainty: Dec;
  sensitivity: Dec;
}

/** Correlation coefficient r between components `a` and `b` (indexes into the component list). */
export interface UncertaintyCorrelation {
  a: number;
  b: number;
  coefficient: Dec;
}

export interface UncertaintyContribution {
  index: number;
  kind: UncertaintyComponentKind;
  label: string;
  /** |c·u| */
  contribution: string;
  /** (c·u)² ÷ combined variance; null when the variance is zero */
  shareOfVariance: string | null;
}

export interface UncertaintyResult {
  combinedVariance: string;
  /** 2 Σ r·(c·u)ᵢ·(c·u)ⱼ — 0 without correlations */
  covarianceTerm: string;
  combinedStandardUncertainty: string;
  coverageFactor: string;
  expandedUncertainty: string;
  contributions: UncertaintyContribution[];
}

/** An inconsistent budget (422 at the API, never computed around). */
export class UncertaintyBudgetError extends Error {}

/**
 * Combined standard uncertainty (NIST TN 1297 §5, SME E4): u_c² = Σ (cᵢuᵢ)² + 2 Σᵢ<ⱼ rᵢⱼ (cᵢuᵢ)(cⱼuⱼ),
 * u_c = √u_c², expanded U = k·u_c (coverage factor k, default 2). Exact decimals (40 digits), results
 * rounded half-even to 8 decimals. Worked example: two independent 3 t readings → u_c = √18 = 4.24264069 t,
 * U = 8.48528137 t. The result informs the acceptance rule; it never sets a tolerance by itself.
 */
export function combineUncertainty(
  components: readonly UncertaintyComponent[],
  correlations: readonly UncertaintyCorrelation[],
  coverageFactor: Dec = new Dec(2),
): UncertaintyResult {
  checkBudget(components, correlations, coverageFactor);
  const weighted = components.map((c) =>
    c.sensitivity.times(c.standardUncertainty),
  );
  const squares = weighted.reduce((sum, w) => sum.plus(w.pow(2)), ZERO);
  const covariance = correlations.reduce(
    (sum, r) =>
      sum.plus(
        r.coefficient.times(weighted[r.a]).times(weighted[r.b]).times(2),
      ),
    ZERO,
  );
  const variance = squares.plus(covariance);
  if (variance.isNegative()) {
    throw new UncertaintyBudgetError(
      'the correlations make the combined variance negative; check the coefficients',
    );
  }
  const combined = variance.sqrt();
  return {
    combinedVariance: formatDec(variance),
    covarianceTerm: formatDec(covariance),
    combinedStandardUncertainty: formatDec(combined),
    coverageFactor: formatDec(coverageFactor),
    expandedUncertainty: formatDec(combined.times(coverageFactor)),
    contributions: components.map((component, index) => ({
      index,
      kind: component.kind,
      label: component.label,
      contribution: formatDec(weighted[index].abs()),
      shareOfVariance: variance.isZero()
        ? null
        : formatDec(weighted[index].pow(2).div(variance)),
    })),
  };
}

function checkBudget(
  components: readonly UncertaintyComponent[],
  correlations: readonly UncertaintyCorrelation[],
  coverageFactor: Dec,
): void {
  if (components.length === 0) {
    throw new UncertaintyBudgetError('a budget needs at least one component');
  }
  if (components.some((c) => c.standardUncertainty.isNegative())) {
    throw new UncertaintyBudgetError(
      'a standard uncertainty is never negative',
    );
  }
  if (!coverageFactor.gt(0) || coverageFactor.gt(10)) {
    throw new UncertaintyBudgetError(
      'the coverage factor k must be in (0, 10]',
    );
  }
  const pairs = new Set<string>();
  for (const r of correlations) {
    const valid = (i: number) =>
      Number.isInteger(i) && i >= 0 && i < components.length;
    if (!valid(r.a) || !valid(r.b) || r.a === r.b) {
      throw new UncertaintyBudgetError(
        'a correlation names two different components of the budget',
      );
    }
    if (r.coefficient.abs().gt(1)) {
      throw new UncertaintyBudgetError(
        'a correlation coefficient is in [-1, 1]',
      );
    }
    const key = [Math.min(r.a, r.b), Math.max(r.a, r.b)].join('|');
    if (pairs.has(key)) {
      throw new UncertaintyBudgetError(
        'each pair of components is correlated once',
      );
    }
    pairs.add(key);
  }
}
