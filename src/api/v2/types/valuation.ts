import type { VersionFields } from './profiles';

/**
 * FX rates, valuation policy versions and demand statuses (backend `src/v2/valuation/*.view.ts`, plan 2.6,
 * D08, SME V1–V8). Rates are decimal strings (`1 fromCurrency = rate toCurrency`); instants ISO 8601 UTC;
 * validity half-open `[effectiveFrom, effectiveTo)`.
 */
export const FX_RATE_TYPES = ['economic', 'group_reporting', 'budget'] as const;
export type FxRateType = (typeof FX_RATE_TYPES)[number];

export interface FxRateView extends VersionFields {
  id: string;
  /** SME V5: the rate table by purpose; the policy picks which one converts */
  rateType: FxRateType;
  fromCurrency: string;
  toCurrency: string;
  /** decimal string: units of toCurrency per 1 fromCurrency */
  rate: string;
  source: string | null;
}

/** SME V7: what an approval queued (the server recalculates the periods it values on the worker). */
export interface RevaluationRequested {
  status: 'queued';
  scope: 'tenant';
  from: string;
  /** null = every later period */
  to: string | null;
}

/** Approve / retire answers carry the revaluation they queued. */
export interface WithRevaluation {
  revaluation?: RevaluationRequested | null;
}

export const DEFAULT_BASES = ['contribution_margin', 'standard_cost', 'economic_impact'] as const;
export type DefaultBasis = (typeof DEFAULT_BASES)[number];

export const TIME_BASIS_RULES = ['exclusive', 'independent_components'] as const;
export type TimeBasisRule = (typeof TIME_BASIS_RULES)[number];

export const FX_POLICIES = ['none', 'snapshot'] as const;
export type FxPolicy = (typeof FX_POLICIES)[number];

export const FX_DATE_RULES = ['event_date', 'period_average'] as const;
export type FxDateRule = (typeof FX_DATE_RULES)[number];

export const DEMAND_RULES = ['demand_constrained_only', 'all_lost_output'] as const;
export type DemandRule = (typeof DEMAND_RULES)[number];

export const QUALITY_DISPOSITIONS = ['scrap', 'downgrade', 'rework'] as const;
export type QualityDisposition = (typeof QUALITY_DISPOSITIONS)[number];

export interface ValuationPolicyView {
  id: string;
  version: number;
  approved: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  /** the stored body, unchanged (v1 may carry the `XXX` placeholder) */
  body: Record<string, unknown>;
  /** reporting currencies as valuation applies them (empty for the `XXX` placeholder) */
  reportingCurrencies: string[];
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}

export const DEMAND_STATUSES = ['demand_constrained', 'not_constrained'] as const;
export type DemandStatusValue = (typeof DEMAND_STATUSES)[number];

/** SME V3: whether a product was sold out over a validity, with its evidence (finance maker-checker). */
export interface DemandStatusView extends VersionFields {
  id: string;
  productId: string;
  status: DemandStatusValue;
  evidence: string;
}
