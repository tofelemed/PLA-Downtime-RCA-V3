import { Dec, ZERO } from '../actuals/decimal';
import { KpiCohort, KpiDraft, KpiMetric, KpiScope, KpiUnit } from './kpi.types';

const ONE = new Dec(1);
/** Ratios keep 10 decimals (`numeric(24,10)`); the stored terms keep 8. */
const RATIO_SCALE = 10;

export interface KpiTerms {
  numerator: Dec | null;
  denominator: Dec | null;
  /** why a term is missing (only read when a term is null) */
  reason?: string;
  /** inputs incomplete (actuals coverage, partial repair evidence): value kept, quality provisional */
  provisional?: string | null;
  cohort?: KpiCohort | null;
}

export interface KpiTarget {
  metric: KpiMetric;
  scope: KpiScope;
  unit?: KpiUnit;
}

/** value null with a reason (KPI03): never 0, 100 % or a default. */
export function unavailable(
  target: KpiTarget,
  terms: KpiTerms,
  reason: string,
): KpiDraft {
  return {
    metric: target.metric,
    scope: target.scope,
    numerator: terms.numerator,
    denominator: terms.denominator,
    value: null,
    unit: target.unit ?? 'ratio',
    quality: 'unavailable',
    reason,
    cohort: terms.cohort ?? null,
  };
}

/**
 * numerator / denominator with the KPI03 rules: a missing term or a zero denominator gives value null
 * with a reason; a ratio above 1 is kept and marked `exception`; incomplete inputs mark it provisional.
 */
export function ratioKpi(
  target: KpiTarget,
  terms: KpiTerms,
  zeroReason: string,
): KpiDraft {
  const { numerator, denominator } = terms;
  if (numerator === null || denominator === null) {
    return unavailable(target, terms, terms.reason ?? 'input_missing');
  }
  if (denominator.isZero()) return unavailable(target, terms, zeroReason);
  const unit = target.unit ?? 'ratio';
  const raw = numerator.div(denominator);
  const value =
    unit === 'ratio'
      ? raw.toDecimalPlaces(RATIO_SCALE)
      : raw.toDecimalPlaces(8);
  const exception = unit === 'ratio' && value.gt(ONE);
  return {
    metric: target.metric,
    scope: target.scope,
    numerator,
    denominator,
    value,
    unit,
    quality: exception ? 'exception' : terms.provisional ? 'provisional' : 'ok',
    reason: exception ? 'above_100_percent' : (terms.provisional ?? null),
    cohort: terms.cohort ?? null,
  };
}

/** An amount (seconds or a count): numerator = value, no denominator. */
export function amountKpi(
  target: KpiTarget,
  amount: Dec,
  extra: { provisional?: string | null; cohort?: KpiCohort | null } = {},
): KpiDraft {
  return {
    metric: target.metric,
    scope: target.scope,
    numerator: amount,
    denominator: null,
    value: amount,
    unit: target.unit ?? 's',
    quality: extra.provisional ? 'provisional' : 'ok',
    reason: extra.provisional ?? null,
    cohort: extra.cohort ?? null,
  };
}

export function sum(values: readonly Dec[]): Dec {
  return values.reduce((total, v) => total.plus(v), ZERO);
}

/** Σ of terms, null as soon as one is null. */
export function sumOrNull(values: readonly (Dec | null)[]): Dec | null {
  let total = ZERO;
  for (const value of values) {
    if (value === null) return null;
    total = total.plus(value);
  }
  return total;
}
