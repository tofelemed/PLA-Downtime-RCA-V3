/**
 * Production profiles, rates, valuation rates and rate imports (backend `src/v2/profiles/profile-v2.view.ts`,
 * plan 2.2). Decimals are strings; instants ISO 8601 UTC; validity half-open `[effectiveFrom, effectiveTo)`.
 */
export type VersionState = 'draft' | 'approved' | 'retired';

export const RATE_KINDS = ['nameplate', 'demonstrated', 'sustained', 'planning', 'budget', 'forecast'] as const;
export type RateKind = (typeof RATE_KINDS)[number];

export const RATE_TIMEBASES = ['s', 'min', 'h', 'd'] as const;
export type RateTimebase = (typeof RATE_TIMEBASES)[number];

export const CAPACITY_MODELS = ['single_stream', 'shared_capacity', 'independent_streams'] as const;
export type CapacityModel = (typeof CAPACITY_MODELS)[number];

export const VALUATION_BASES = [
  'contribution_margin',
  'standard_cost',
  'cost_per_hour',
  'variable_cost',
  'salvage_value',
  'disposal_cost',
  'downgrade_price_difference',
  'rework_cost',
] as const;
export type ValuationBasis = (typeof VALUATION_BASES)[number];

export interface VersionFields {
  version: number;
  state: VersionState;
  effectiveFrom: string;
  effectiveTo: string | null;
  /** author of the draft (separation of duties); optional until every server view carries it */
  createdBy?: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

/** v1 values kept on a seeded draft profile for review only (MIG §18.2, D08). */
export interface LegacyProfileValues {
  capacity: string | null;
  capacityUom: string | null;
  idealCycleTime: string | null;
  standardRate: string | null;
  standardRateStatus: 'unconfirmed_legacy_cost';
}

export interface ProfileView extends VersionFields {
  id: string;
  unitId: string;
  productId: string;
  operatingMode: string;
  quantityUom: string | null;
  rateTimebase: RateTimebase | null;
  capacityModel: CapacityModel;
  actualsPolicyId: string | null;
  oeePolicyId: string | null;
  valuationPolicyId: string | null;
  productMixConstraints: Record<string, unknown> | null;
  legacy: LegacyProfileValues | null;
}

export interface RateView extends VersionFields {
  id: string;
  profileId: string;
  rateKind: RateKind;
  rate: string;
  timebase: RateTimebase;
  /** the server's conversion to quantity per second (8 dp) — never computed in the browser */
  ratePerSecond: string;
  source: 'manual' | 'import';
  externalId: string | null;
  rateImportId: string | null;
}

export interface ValuationRateView extends VersionFields {
  id: string;
  profileId: string | null;
  impactCodeId: string | null;
  basis: ValuationBasis;
  value: string;
  currency: string;
  perUom: string;
}

export interface ImportRowError {
  line: number;
  code: string;
  message: string;
}

export interface RateImportView {
  id: string;
  kind: 'budget' | 'forecast' | 'mpc';
  externalId: string;
  revision: number;
  fileRef: string | null;
  state: string;
  counts: Record<string, number> | null;
  report: ImportRowError[];
  importedBy: string | null;
  createdAt: string;
  finishedAt: string | null;
}

/** `details.conflicts[]` of 409 VERSION_OVERLAP. */
export interface VersionConflict {
  id: string;
  version: number;
  effectiveFrom: string;
  effectiveTo: string | null;
}
