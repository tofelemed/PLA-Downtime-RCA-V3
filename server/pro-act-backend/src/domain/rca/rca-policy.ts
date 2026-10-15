import {
  integer,
  nullableNumber,
  oneOf,
  Raw,
  RcaPolicyError,
  record,
  section,
  share,
  stringList,
} from './policy-values';
import {
  parseEffectiveness,
  parseFiveWhy,
  parseFmea,
  parseInvestigation,
  RCA_RULES_DEFAULT,
  RcaRules,
} from './rca-policy-rules';

export { RcaPolicyError } from './policy-values';

/** How repeats are counted (CA8: at least asset plus failure mode; refined by mechanism once known). */
export const REPEAT_MATCHES = [
  'asset',
  'asset_and_mode',
  'asset_mode_and_mechanism',
] as const;
export type RepeatMatch = (typeof REPEAT_MATCHES)[number];
export const COST_CURRENCIES = ['IRR', 'USD'] as const;

/** D17: production thresholds of critical assets are multiplied by `thresholdFactor` (0.5 = halved). */
export interface CriticalAssetRule {
  /** `assets.criticality` values (case-insensitive) that make an asset critical */
  criticalities: string[];
  thresholdFactor: number;
}

/** CA8 bad actor: same asset and mode, unplanned downtime summed over a rolling window. */
export interface CumulativeRule {
  windowDays: number;
  downtimeSeconds: number;
}

/** D17 safety override: events with these consequence markers fire whatever their loss. */
export interface ConsequenceRule {
  /** `production_events.sol_type` values, e.g. Safety */
  solTypes: string[];
  /** `production_events.severity` values, e.g. Critical */
  severities: string[];
}

/**
 * `rca_policy` body (contracts/policies/rca_policy.schema.json; D13, extended by SME D17 and CA2–CA8):
 * any-of triggers, then the investigation, FMEA, 5-Why and effectiveness rules of the case workflow.
 */
export interface RcaPolicy extends RcaRules {
  /** unplanned downtime at or above this fires; 0 disables */
  durationThresholdSeconds: number;
  /** approved valued impact (policy default view, SME V8) at or above this fires; null disables (finance sets it) */
  costThreshold: number | null;
  costCurrency: (typeof COST_CURRENCIES)[number] | null;
  /** approved lost quantity at or above this share of the unit's daily planned quantity fires; null off */
  lostQuantityShareOfDailyPlan: number | null;
  /** same-mode incidents within `repeatWindowDays` that fire the repeat trigger */
  repeatCount: number;
  repeatWindowDays: number;
  repeatMatch: RepeatMatch;
  criticalAssets: CriticalAssetRule;
  cumulative: CumulativeRule | null;
  consequence: ConsequenceRule;
  autoCreate: 'recommend' | 'create';
}

const NO_CRITICAL: CriticalAssetRule = {
  criticalities: [],
  thresholdFactor: 1,
};
const NO_CONSEQUENCE: ConsequenceRule = { solTypes: [], severities: [] };

/**
 * Seed default (`contracts/policies/defaults/rca_policy.default.json`): the SME D17 pilot — ≥ 2 h OR 1 %
 * of the daily plan OR 3 same-mode incidents in 30 days, halved for critical assets, safety markers
 * override; cost trigger off until finance sets the money limit. Triage settings to calibrate.
 */
export const RCA_POLICY_DEFAULT: RcaPolicy = {
  durationThresholdSeconds: 7200,
  costThreshold: null,
  costCurrency: null,
  lostQuantityShareOfDailyPlan: 0.01,
  repeatCount: 3,
  repeatWindowDays: 30,
  repeatMatch: 'asset_and_mode',
  criticalAssets: { criticalities: ['critical'], thresholdFactor: 0.5 },
  cumulative: { windowDays: 90, downtimeSeconds: 28800 },
  consequence: { solTypes: ['Safety'], severities: ['Critical'] },
  autoCreate: 'recommend',
  ...RCA_RULES_DEFAULT,
};

/**
 * The money limit and its currency. A D13 version could store a threshold without currency (the cost
 * trigger was not built then): it stays inert (no currency, nothing compares). New versions name both
 * (`assertCostCurrency`).
 */
function parseCost(
  raw: Raw,
): Pick<RcaPolicy, 'costThreshold' | 'costCurrency'> {
  const costThreshold = nullableNumber(raw.costThreshold, 'costThreshold');
  const currency = raw.costCurrency ?? null;
  return {
    costThreshold,
    costCurrency:
      costThreshold === null || currency === null
        ? null
        : oneOf(currency, COST_CURRENCIES, 'costCurrency'),
  };
}

/** A new version with a money limit names its currency (finance sets both, D17). */
export function assertCostCurrency(policy: RcaPolicy): void {
  if (policy.costThreshold !== null && !policy.costCurrency) {
    throw new RcaPolicyError('costCurrency is required with a costThreshold');
  }
}

function parseCritical(raw: Raw): CriticalAssetRule {
  return {
    criticalities: stringList(raw.criticalities, 'criticalities').map((value) =>
      value.trim().toLowerCase(),
    ),
    thresholdFactor: share(raw.thresholdFactor, 'thresholdFactor'),
  };
}

function parseCumulative(value: unknown): CumulativeRule | null {
  if (value === undefined || value === null) return null;
  const raw = record(value, 'cumulative');
  return {
    windowDays: integer(raw.windowDays, 'cumulative.windowDays', 1),
    downtimeSeconds: integer(
      raw.downtimeSeconds,
      'cumulative.downtimeSeconds',
      1,
    ),
  };
}

function parseConsequence(raw: Raw): ConsequenceRule {
  return {
    solTypes: stringList(raw.solTypes, 'solTypes'),
    severities: stringList(raw.severities, 'severities'),
  };
}

function parseTriggerFields(raw: Raw): Omit<RcaPolicy, keyof RcaRules> {
  const quantity = raw.lostQuantityShareOfDailyPlan ?? null;
  return {
    durationThresholdSeconds: integer(
      raw.durationThresholdSeconds,
      'durationThresholdSeconds',
    ),
    ...parseCost(raw),
    lostQuantityShareOfDailyPlan:
      quantity === null
        ? null
        : share(quantity, 'lostQuantityShareOfDailyPlan'),
    repeatCount: integer(raw.repeatCount, 'repeatCount', 1),
    repeatWindowDays: integer(raw.repeatWindowDays, 'repeatWindowDays', 1),
    // a version written before CA8 counted repeats per asset
    repeatMatch:
      raw.repeatMatch === undefined
        ? 'asset'
        : oneOf(raw.repeatMatch, REPEAT_MATCHES, 'repeatMatch'),
    criticalAssets: section(raw, 'criticalAssets', NO_CRITICAL, parseCritical),
    cumulative: parseCumulative(raw.cumulative),
    consequence: section(raw, 'consequence', NO_CONSEQUENCE, parseConsequence),
    autoCreate: oneOf(
      raw.autoCreate,
      ['recommend', 'create'] as const,
      'autoCreate',
    ),
  };
}

/**
 * Validates a stored body; a malformed policy is an error, never a silent default. Trigger options a
 * version written before them does not carry are off (legacy behaviour); workflow rule sections it does
 * not carry take the proposed standard ones (they did not exist, so nothing was decided otherwise).
 */
export function parseRcaPolicy(body: unknown): RcaPolicy {
  const raw = record(body, 'rca_policy body');
  return {
    ...parseTriggerFields(raw),
    effectiveness: section(
      raw,
      'effectiveness',
      RCA_RULES_DEFAULT.effectiveness,
      parseEffectiveness,
    ),
    fmea: section(raw, 'fmea', RCA_RULES_DEFAULT.fmea, parseFmea),
    fiveWhy: section(raw, 'fiveWhy', RCA_RULES_DEFAULT.fiveWhy, parseFiveWhy),
    investigation: section(
      raw,
      'investigation',
      RCA_RULES_DEFAULT.investigation,
      parseInvestigation,
    ),
  };
}

/** True when the asset's criticality is one the policy names critical. */
export function isCriticalAsset(
  policy: RcaPolicy,
  criticality: string | null,
): boolean {
  if (!criticality) return false;
  return policy.criticalAssets.criticalities.includes(
    criticality.trim().toLowerCase(),
  );
}

/** A production threshold, multiplied by the critical-asset factor when the asset is critical. */
export function productionThreshold(
  policy: RcaPolicy,
  value: number,
  critical: boolean,
): number {
  return critical ? value * policy.criticalAssets.thresholdFactor : value;
}
