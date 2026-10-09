import { ValuationPolicySnapshot } from './valuation.types';

export class ValuationPolicyError extends Error {}

/** `valuation_basis` body (contracts/policies/valuation_basis.schema.json, D08). */
export interface ValuationPolicyBody {
  defaultBasis: 'contribution_margin' | 'standard_cost';
  timeBasisRule: 'exclusive' | 'independent_components';
  /** v1 only: a single tenant currency (`XXX` = undecided) */
  currency?: string;
  /** from version 2: every valued loss is reported in each of these (D08 2026-10-09: IRR and USD) */
  reportingCurrencies?: string[];
  fxPolicy: 'none' | 'snapshot';
  independentImpactCodeIds?: string[];
}

/** The seeded version 1 (contracts default of 2026-10-07): placeholder currency, kept as history. */
export const VALUATION_POLICY_V1_BODY: ValuationPolicyBody = {
  defaultBasis: 'contribution_margin',
  timeBasisRule: 'exclusive',
  currency: 'XXX',
  fxPolicy: 'none',
};

/** D08 Q2 answer of 2026-10-09 (`valuation_basis.v2.default.json`): IRR and USD through approved FX rates. */
export const VALUATION_POLICY_V2_BODY: ValuationPolicyBody = {
  defaultBasis: 'contribution_margin',
  timeBasisRule: 'exclusive',
  reportingCurrencies: ['IRR', 'USD'],
  fxPolicy: 'snapshot',
  independentImpactCodeIds: [],
};

const CURRENCY = /^[A-Z]{3}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T {
  if (!(allowed as readonly unknown[]).includes(value)) {
    throw new ValuationPolicyError(
      `${field} must be one of ${allowed.join(', ')}`,
    );
  }
  return value as T;
}

function strings(value: unknown, pattern: RegExp, field: string): string[] {
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    !value.every((v) => typeof v === 'string' && pattern.test(v))
  ) {
    throw new ValuationPolicyError(`${field} must be a list of valid codes`);
  }
  return [...new Set(value as string[])];
}

/** Reporting currencies of a body: the v2 list, else the v1 currency unless it is the `XXX` placeholder. */
function currenciesOf(value: Record<string, unknown>): string[] {
  if (value.reportingCurrencies !== undefined) {
    const list = strings(
      value.reportingCurrencies,
      CURRENCY,
      'reportingCurrencies',
    );
    if (list.length === 0)
      throw new ValuationPolicyError('reportingCurrencies must not be empty');
    return list;
  }
  if (typeof value.currency !== 'string' || !CURRENCY.test(value.currency)) {
    throw new ValuationPolicyError(
      'currency or reportingCurrencies is required',
    );
  }
  return value.currency === 'XXX' ? [] : [value.currency];
}

/** Parses a stored body into what valuation applies; refuses a malformed body instead of guessing. */
export function parseValuationPolicy(
  body: unknown,
  ref: { id: string | null; version: number | null; approved: boolean },
): ValuationPolicySnapshot {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ValuationPolicyError('policy body must be an object');
  }
  const value = body as Record<string, unknown>;
  const currencies = currenciesOf(value);
  return {
    ...ref,
    // VAL01: an undecided currency (`XXX`) can never be in production use, approved or not
    approved: ref.approved && currencies.length > 0,
    defaultBasis: oneOf(
      value.defaultBasis,
      ['contribution_margin', 'standard_cost'],
      'defaultBasis',
    ),
    timeBasisRule: oneOf(
      value.timeBasisRule,
      ['exclusive', 'independent_components'],
      'timeBasisRule',
    ),
    currencies,
    fxPolicy: oneOf(value.fxPolicy, ['none', 'snapshot'], 'fxPolicy'),
    independentImpactCodeIds: strings(
      value.independentImpactCodeIds,
      UUID,
      'independentImpactCodeIds',
    ),
  };
}
