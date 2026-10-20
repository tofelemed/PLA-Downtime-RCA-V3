/**
 * Capacity gap report (backend `src/v2/reports/capacity-gap-v2.view.ts`, plan 1.2, D-T1). Hand-written: the
 * OpenAPI snapshot describes the query, not the body. Rates, gaps and ratios are decimal strings computed on
 * the server; null = not set or not comparable (`reason`).
 */
import type { RateKind, RateTimebase } from './profiles';

export type CapacityGapReason = 'not_set' | 'uom_mismatch' | 'timebase_mismatch' | 'zero_base';

/** The approved version of one kind in force at `at`; every field null when the kind is not set. */
export interface CapacityKindView {
  value: string | null;
  uom: string | null;
  timebase: RateTimebase | null;
  rateVersionId: string | null;
  version: number | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
}

export interface CapacityGapStepView {
  upper: RateKind;
  lower: RateKind;
  /** upper − lower (negative when the lower kind is higher) */
  gap: string | null;
  /** gap ÷ upper */
  ratio: string | null;
  reason: Exclude<CapacityGapReason, 'zero_base'> | null;
}

export interface CapacityRatioView {
  numerator: RateKind;
  denominator: RateKind;
  ratio: string | null;
  reason: CapacityGapReason | null;
}

export interface CapacityGapRowView {
  profileId: string;
  profileVersion: number;
  unitId: string;
  unitName: string;
  productId: string;
  productName: string;
  operatingMode: string;
  quantityUom: string | null;
  rates: Record<RateKind, CapacityKindView>;
  /** nameplate → demonstrated, demonstrated → sustained, sustained → planning */
  gaps: CapacityGapStepView[];
  /** sustained ÷ nameplate, planning ÷ sustained */
  ratios: CapacityRatioView[];
}

export interface CapacityGapReportView {
  at: string;
  items: CapacityGapRowView[];
  limit: number;
  /** more approved profiles match than `limit` rows */
  truncated: boolean;
  asOf: string;
}

/** `GET /reports/capacity-gap` query (`at` default now; units default to the caller's scope). */
export interface CapacityGapQuery {
  at?: string;
  unitIds?: string[];
  productIds?: string[];
  limit?: number;
}
