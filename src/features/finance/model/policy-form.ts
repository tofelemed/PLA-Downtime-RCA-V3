import type { ValuationPolicyCreateBody } from '@/api/v2/queries/valuation';
import {
  DEFAULT_BASES,
  FX_POLICIES,
  TIME_BASIS_RULES,
  type DefaultBasis,
  type FxPolicy,
  type TimeBasisRule,
  type ValuationPolicyView,
} from '@/api/v2/types/valuation';
import type { FieldErrors } from './field-errors';

/**
 * A new valuation policy version (plan 2.6, VAL01, D08). The form starts from an existing version's
 * stored body ("new version from this") or from the D08 answer (IRR and USD, FX snapshot, contribution
 * margin, exclusive). The browser checks only the request shape `POST /valuation-policies` validates;
 * the policy rules (impact codes of the tenant, the parser) are the server's (422).
 */
export interface PolicyFormValues {
  defaultBasis: DefaultBasis;
  timeBasisRule: TimeBasisRule;
  reportingCurrencies: string[];
  fxPolicy: FxPolicy;
  independentImpactCodeIds: string[];
  /** ISO UTC instant (DateTimeInput) */
  effectiveFrom: string | null;
  notes: string;
}

/** D08 Q2 (2026-10-09): every valued loss is reported in IRR and USD. */
export const REPORTING_CURRENCIES = ['IRR', 'USD'] as const;
const CURRENCY = /^[A-Z]{3}$/;
const NOTES_MAX = 2000;

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;

const stringList = (value: unknown): string[] => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []);

export function policyFormOf(source: ValuationPolicyView | null): PolicyFormValues {
  const body = source?.body ?? {};
  const currencies = source && source.reportingCurrencies.length > 0 ? source.reportingCurrencies : [...REPORTING_CURRENCIES];
  return {
    defaultBasis: oneOf(body.defaultBasis, DEFAULT_BASES, 'contribution_margin'),
    timeBasisRule: oneOf(body.timeBasisRule, TIME_BASIS_RULES, 'exclusive'),
    reportingCurrencies: [...currencies],
    fxPolicy: oneOf(body.fxPolicy, FX_POLICIES, 'snapshot'),
    independentImpactCodeIds: stringList(body.independentImpactCodeIds),
    effectiveFrom: null,
    notes: '',
  };
}

export function validatePolicyForm(values: PolicyFormValues): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.effectiveFrom) errors.effectiveFrom = 'Enter the date and time it starts.';
  const currencies = values.reportingCurrencies;
  if (currencies.length < 1) errors.reportingCurrencies = 'Choose at least one reporting currency.';
  else if (currencies.length > 2) errors.reportingCurrencies = 'Choose at most two reporting currencies.';
  else if (!currencies.every((code) => CURRENCY.test(code))) errors.reportingCurrencies = 'Choose currencies from the list.';
  if (values.notes.trim().length > NOTES_MAX) errors.notes = `Use at most ${NOTES_MAX} characters.`;
  return errors;
}

export function policyCreateBody(values: PolicyFormValues): ValuationPolicyCreateBody {
  const independent = values.timeBasisRule === 'independent_components';
  return {
    defaultBasis: values.defaultBasis,
    timeBasisRule: values.timeBasisRule,
    reportingCurrencies: [...values.reportingCurrencies],
    fxPolicy: values.fxPolicy,
    independentImpactCodeIds: independent ? [...values.independentImpactCodeIds] : [],
    effectiveFrom: values.effectiveFrom as string,
    notes: values.notes.trim() || null,
  };
}
