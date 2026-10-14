import {
  DEMAND_RULES,
  FX_DATE_RULES,
  FX_RATE_TYPES,
  QUALITY_DISPOSITIONS,
  type DemandRule,
  type FxDateRule,
  type FxRateType,
  type QualityDisposition,
} from '@/api/v2/types/valuation';

/**
 * The version-3 fields of a valuation policy (SME V2–V6, 14 Oct 2026): which FX table and date rule
 * convert, whether the economic view is on (a demand rule) and how quality losses are disposed. The
 * browser only shapes the request; what the values mean is the server's.
 */
export interface EconomicFormValues {
  fxRateType: FxRateType;
  fxDateRule: FxDateRule;
  /** ratio as typed (e.g. 0.05); empty = no volatility check */
  fxAverageMaxDeviation: string;
  /** 'none' = no economic view */
  demandRule: DemandRule | 'none';
  /** impact code id → disposition */
  qualityDispositions: Record<string, QualityDisposition>;
  defaultQualityDisposition: QualityDisposition | 'none';
  manualLineHours: boolean;
}

/** The SME answers' pilot settings, used for a first version (finance confirms them). */
export const SME_ECONOMIC_DEFAULTS: EconomicFormValues = {
  fxRateType: 'economic',
  fxDateRule: 'event_date',
  fxAverageMaxDeviation: '0.05',
  demandRule: 'demand_constrained_only',
  qualityDispositions: {},
  defaultQualityDisposition: 'none',
  manualLineHours: true,
};

const RATIO = /^(0(\.\d{1,6})?|1(\.0{1,6})?)$/;

const oneOf = <T extends string>(value: unknown, allowed: readonly T[]): T | null =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : null;

function dispositionsOf(value: unknown): Record<string, QualityDisposition> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, unknown>).flatMap(([id, d]) => {
    const disposition = oneOf(d, QUALITY_DISPOSITIONS);
    return disposition ? [[id, disposition] as const] : [];
  });
  return Object.fromEntries(entries);
}

/** The v3 fields of a stored body; an older body (no v3 fields) starts from the pilot settings. */
export function economicFormOf(body: Record<string, unknown> | null): EconomicFormValues {
  if (!body || (body.demandRule === undefined && body.fxRateType === undefined)) return { ...SME_ECONOMIC_DEFAULTS };
  const deviation = body.fxAverageMaxDeviation;
  return {
    fxRateType: oneOf(body.fxRateType, FX_RATE_TYPES) ?? 'economic',
    fxDateRule: oneOf(body.fxDateRule, FX_DATE_RULES) ?? 'event_date',
    fxAverageMaxDeviation: typeof deviation === 'string' ? deviation : '',
    demandRule: oneOf(body.demandRule, DEMAND_RULES) ?? 'none',
    qualityDispositions: dispositionsOf(body.qualityDispositions),
    defaultQualityDisposition: oneOf(body.defaultQualityDisposition, QUALITY_DISPOSITIONS) ?? 'none',
    manualLineHours: body.manualLineHours === true,
  };
}

export function economicErrors(values: EconomicFormValues, defaultBasis: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (defaultBasis === 'economic_impact' && values.demandRule === 'none') {
    errors.defaultBasis = 'The economic view needs a lost-sales rule.';
  }
  const deviation = values.fxAverageMaxDeviation.trim();
  if (deviation && !RATIO.test(deviation)) errors.fxAverageMaxDeviation = 'Enter a ratio between 0 and 1, e.g. 0.05.';
  return errors;
}

export interface EconomicBody {
  fxRateType: FxRateType;
  fxDateRule: FxDateRule;
  fxAverageMaxDeviation: string | null;
  demandRule?: DemandRule;
  qualityDispositions?: Record<string, QualityDisposition>;
  defaultQualityDisposition?: QualityDisposition | null;
  manualLineHours?: boolean;
}

/** The v3 request fields; the economic rules only when a lost-sales rule is chosen. */
export function economicBody(values: EconomicFormValues): EconomicBody {
  const fx = {
    fxRateType: values.fxRateType,
    fxDateRule: values.fxDateRule,
    fxAverageMaxDeviation: values.fxAverageMaxDeviation.trim() || null,
  };
  if (values.demandRule === 'none') return fx;
  return {
    ...fx,
    demandRule: values.demandRule,
    qualityDispositions: { ...values.qualityDispositions },
    defaultQualityDisposition: values.defaultQualityDisposition === 'none' ? null : values.defaultQualityDisposition,
    manualLineHours: values.manualLineHours,
  };
}
