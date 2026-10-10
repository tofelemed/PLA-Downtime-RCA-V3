import type { VersionFields } from './profiles';

/**
 * FX rates and valuation policy versions (backend `src/v2/valuation/valuation-v2.view.ts`, plan 2.6, D08).
 * Rates are decimal strings (`1 fromCurrency = rate toCurrency`); instants ISO 8601 UTC; validity
 * half-open `[effectiveFrom, effectiveTo)`.
 */
export interface FxRateView extends VersionFields {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  /** decimal string: units of toCurrency per 1 fromCurrency */
  rate: string;
  source: string | null;
}

export const DEFAULT_BASES = ['contribution_margin', 'standard_cost'] as const;
export type DefaultBasis = (typeof DEFAULT_BASES)[number];

export const TIME_BASIS_RULES = ['exclusive', 'independent_components'] as const;
export type TimeBasisRule = (typeof TIME_BASIS_RULES)[number];

export const FX_POLICIES = ['none', 'snapshot'] as const;
export type FxPolicy = (typeof FX_POLICIES)[number];

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
