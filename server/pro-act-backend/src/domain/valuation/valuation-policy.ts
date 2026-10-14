import {
  DEMAND_RULES,
  DefaultBasis,
  EconomicRules,
  FX_DATE_RULES,
  FX_RATE_TYPES,
  FxRule,
  QUALITY_DISPOSITIONS,
  QualityDisposition,
  ValuationPolicySnapshot,
} from './valuation.types';

export class ValuationPolicyError extends Error {}

/** `valuation_basis` body (contracts/policies/valuation_basis.schema.json, D08). */
export interface ValuationPolicyBody {
  defaultBasis: DefaultBasis;
  timeBasisRule: 'exclusive' | 'independent_components';
  /** v1 only: a single tenant currency (`XXX` = undecided) */
  currency?: string;
  /** from version 2: every valued loss is reported in each of these (D08 2026-10-09: IRR and USD) */
  reportingCurrencies?: string[];
  fxPolicy: 'none' | 'snapshot';
  independentImpactCodeIds?: string[];
  /** from version 3 (SME V5 / V6): which FX table and which date basis convert the values */
  fxRateType?: FxRule['rateType'];
  fxDateRule?: FxRule['dateRule'];
  fxAverageMaxDeviation?: string | null;
  /** from version 3 (SME V2–V4): the economic view */
  demandRule?: EconomicRules['demandRule'];
  qualityDispositions?: Record<string, QualityDisposition>;
  defaultQualityDisposition?: QualityDisposition | null;
  manualLineHours?: boolean;
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

/**
 * SME answers of 14 Oct 2026 (`valuation_basis.v3.default.json`): the economic view is the default
 * management value (V8), lost output is lost contribution only when demand was constrained (V3), FX from
 * the `economic` table at the event date (V5 / V6; a month average is refused beyond 5 % deviation),
 * manual downtime lines get hours only from their evidenced events (V4). Quality dispositions are left to
 * finance (no default: unmapped quality lines stay unvalued). Seeded unapproved; finance approves.
 */
export const VALUATION_POLICY_V3_BODY: ValuationPolicyBody = {
  defaultBasis: 'economic_impact',
  timeBasisRule: 'exclusive',
  reportingCurrencies: ['IRR', 'USD'],
  fxPolicy: 'snapshot',
  independentImpactCodeIds: [],
  fxRateType: 'economic',
  fxDateRule: 'event_date',
  fxAverageMaxDeviation: '0.05',
  demandRule: 'demand_constrained_only',
  qualityDispositions: {},
  defaultQualityDisposition: null,
  manualLineHours: true,
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

const RATIO = /^(0(\.\d{1,6})?|1(\.0{1,6})?)$/;

/** v3 FX rule, only when the body names one (v1 / v2 bodies keep their snapshot unchanged). */
function fxRuleOf(value: Record<string, unknown>): FxRule | undefined {
  if (value.fxRateType === undefined && value.fxDateRule === undefined)
    return undefined;
  const deviation = value.fxAverageMaxDeviation ?? null;
  if (
    deviation !== null &&
    (typeof deviation !== 'string' || !RATIO.test(deviation))
  )
    throw new ValuationPolicyError(
      'fxAverageMaxDeviation must be a ratio between 0 and 1',
    );
  return {
    rateType: oneOf(
      value.fxRateType ?? 'economic',
      FX_RATE_TYPES,
      'fxRateType',
    ),
    dateRule: oneOf(
      value.fxDateRule ?? 'event_date',
      FX_DATE_RULES,
      'fxDateRule',
    ),
    maxAverageDeviation: deviation,
  };
}

function dispositionsOf(value: unknown): Record<string, QualityDisposition> {
  if (value === undefined) return {};
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new ValuationPolicyError(
      'qualityDispositions must map impact code ids to dispositions',
    );
  const entries = Object.entries(value as Record<string, unknown>);
  return Object.fromEntries(
    entries.map(([id, disposition]) => {
      if (!UUID.test(id))
        throw new ValuationPolicyError(
          'qualityDispositions keys must be impact code ids',
        );
      return [
        id,
        oneOf(disposition, QUALITY_DISPOSITIONS, 'qualityDispositions'),
      ];
    }),
  );
}

/** v3 economic rules, only when the body names a demand rule. */
function economicOf(value: Record<string, unknown>): EconomicRules | undefined {
  if (value.demandRule === undefined) return undefined;
  const fallback = value.defaultQualityDisposition ?? null;
  if (
    value.manualLineHours !== undefined &&
    typeof value.manualLineHours !== 'boolean'
  )
    throw new ValuationPolicyError('manualLineHours must be a boolean');
  return {
    demandRule: oneOf(value.demandRule, DEMAND_RULES, 'demandRule'),
    qualityDispositions: dispositionsOf(value.qualityDispositions),
    defaultQualityDisposition:
      fallback === null
        ? null
        : oneOf(fallback, QUALITY_DISPOSITIONS, 'defaultQualityDisposition'),
    manualLineHours: value.manualLineHours === true,
  };
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
  const fx = fxRuleOf(value);
  const economic = economicOf(value);
  return {
    ...ref,
    // VAL01: an undecided currency (`XXX`) can never be in production use, approved or not
    approved: ref.approved && currencies.length > 0,
    defaultBasis: defaultBasisOf(value.defaultBasis, economic),
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
    ...(fx ? { fx } : {}),
    ...(economic ? { economic } : {}),
  };
}

/** The economic view can only be the default when the body defines it (V8). */
function defaultBasisOf(
  value: unknown,
  economic: EconomicRules | undefined,
): DefaultBasis {
  const allowed: DefaultBasis[] = economic
    ? ['contribution_margin', 'standard_cost', 'economic_impact']
    : ['contribution_margin', 'standard_cost'];
  return oneOf(value, allowed, 'defaultBasis');
}
