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
import { backdateErrors, EMPTY_BACKDATE, type BackdateDraft } from '@/features/policy-backdate/backdate-model';
import type { FieldErrors } from './field-errors';
import { economicBody, economicErrors, economicFormOf, type EconomicFormValues } from './policy-economic';

/**
 * A new valuation policy version (plan 2.6, VAL01, D08). The form starts from an existing version's
 * stored body ("new version from this") or from the SME answers of 14 Oct 2026 (IRR and USD, economic view
 * by default, lost sales only when sold out, FX economic table at the event date). The browser checks only the request shape `POST /valuation-policies` validates;
 * the policy rules (impact codes of the tenant, the parser) are the server's (422).
 */
export interface PolicyFormValues {
  defaultBasis: DefaultBasis;
  timeBasisRule: TimeBasisRule;
  reportingCurrencies: string[];
  fxPolicy: FxPolicy;
  independentImpactCodeIds: string[];
  /** version-3 fields (SME V2–V6) */
  economic: EconomicFormValues;
  /** ISO UTC instant (DateTimeInput); now or later — a past start is the commissioning backdate below */
  effectiveFrom: string | null;
  /** commissioning backdate (owner, 18 Oct 2026): a past start with its reason, replacing `effectiveFrom` */
  backdate: BackdateDraft;
  /** with a backdate over approved figures: approval opens a change proposal for each of them */
  restateApproved: boolean;
  notes: string;
}

/** D08 Q2 (2026-10-09): every valued loss is reported in IRR and USD. */
export const REPORTING_CURRENCIES = ['IRR', 'USD'] as const;
const CURRENCY = /^[A-Z]{3}$/;
const NOTES_MAX = 2000;

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;

const stringList = (value: unknown): string[] => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []);

/**
 * The default basis of the approved version in force at `now` (QA L19: a fresh "New policy version"
 * starts from it, not from the economic view); null when none is in force.
 */
export function inForceBasis(policies: readonly ValuationPolicyView[], now: Date = new Date()): DefaultBasis | null {
  const at = now.getTime();
  const inForce = policies
    .filter((policy) => policy.approved && Date.parse(policy.effectiveFrom) <= at && (!policy.effectiveTo || Date.parse(policy.effectiveTo) > at))
    .sort((a, b) => b.version - a.version)[0];
  const basis = inForce?.body.defaultBasis;
  return typeof basis === 'string' && (DEFAULT_BASES as readonly string[]).includes(basis) ? (basis as DefaultBasis) : null;
}

/** The form of a copy of `source`, or of a fresh version whose basis is `freshBasis` (the in-force one). */
export function policyFormOf(source: ValuationPolicyView | null, freshBasis: DefaultBasis | null = null): PolicyFormValues {
  const body = source?.body ?? {};
  const currencies = source && source.reportingCurrencies.length > 0 ? source.reportingCurrencies : [...REPORTING_CURRENCIES];
  return {
    defaultBasis: oneOf(body.defaultBasis, DEFAULT_BASES, source ? 'contribution_margin' : freshBasis ?? 'economic_impact'),
    timeBasisRule: oneOf(body.timeBasisRule, TIME_BASIS_RULES, 'exclusive'),
    reportingCurrencies: [...currencies],
    fxPolicy: oneOf(body.fxPolicy, FX_POLICIES, 'snapshot'),
    independentImpactCodeIds: stringList(body.independentImpactCodeIds),
    economic: economicFormOf(source ? body : null),
    effectiveFrom: null,
    backdate: { ...EMPTY_BACKDATE },
    restateApproved: false,
    notes: '',
  };
}

/** The start: a commissioning backdate (past instant and reason) or a start from now on. */
function startErrors(values: PolicyFormValues, now: Date): FieldErrors {
  if (values.backdate.effectiveFrom) {
    const found = backdateErrors(values.backdate, now);
    const errors: FieldErrors = {};
    if (found.effectiveFrom) errors.backdateEffectiveFrom = found.effectiveFrom;
    if (found.reason) errors.backdateReason = found.reason;
    return errors;
  }
  if (values.backdate.reason.trim()) return { backdateEffectiveFrom: 'Choose the effective-from, or clear the reason' };
  if (!values.effectiveFrom) return { effectiveFrom: 'Enter the date and time it starts.' };
  if (Date.parse(values.effectiveFrom) < now.getTime()) return { effectiveFrom: 'A past start is a commissioning backdate: set it under Commissioning with a reason.' };
  return {};
}

export function validatePolicyForm(values: PolicyFormValues, now: Date = new Date()): FieldErrors {
  const errors: FieldErrors = { ...economicErrors(values.economic, values.defaultBasis), ...startErrors(values, now) };
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
    ...economicBody(values.economic),
    ...startBody(values),
    notes: values.notes.trim() || null,
  };
}

function startBody(values: PolicyFormValues): Pick<ValuationPolicyCreateBody, 'effectiveFrom' | 'backdateReason' | 'restateApproved'> {
  const { effectiveFrom, reason } = values.backdate;
  if (!effectiveFrom) return { effectiveFrom: values.effectiveFrom as string };
  return { effectiveFrom, backdateReason: reason.trim(), ...(values.restateApproved ? { restateApproved: true } : {}) };
}
