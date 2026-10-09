/**
 * Vocabulary of production profiles and rates (plan 2.2, PLAN01, §3.1 capacity vocabulary, §14.2).
 * Nameplate, demonstrated, sustained (MSC/MPC), planning, budget and forecast are separate rate kinds —
 * never one "target" (§3.1).
 */
export const VERSION_STATES = ['draft', 'approved', 'retired'] as const;
export type VersionState = (typeof VERSION_STATES)[number];

export const RATE_TIMEBASES = ['s', 'min', 'h', 'd'] as const;

export const CAPACITY_MODELS = [
  'single_stream',
  'shared_capacity',
  'independent_streams',
] as const;
export type CapacityModel = (typeof CAPACITY_MODELS)[number];

export const RATE_KINDS = [
  'nameplate',
  'demonstrated',
  'sustained',
  'planning',
  'budget',
  'forecast',
] as const;
export type RateKind = (typeof RATE_KINDS)[number];

/** Kinds that divide a quantity (ideal time, capacity): a zero rate is meaningless there. */
export const POSITIVE_RATE_KINDS: ReadonlySet<RateKind> = new Set([
  'nameplate',
  'demonstrated',
  'sustained',
  'planning',
]);

export const RATE_SOURCES = ['manual', 'import'] as const;
export type RateSource = (typeof RATE_SOURCES)[number];

export const VALUATION_BASES = [
  'contribution_margin',
  'standard_cost',
  'cost_per_hour',
] as const;
export type ValuationBasis = (typeof VALUATION_BASES)[number];

export const RATE_IMPORT_KINDS = ['budget', 'forecast', 'mpc'] as const;
export type RateImportKind = (typeof RATE_IMPORT_KINDS)[number];

export const RATE_IMPORT_STATES = ['queued', 'completed', 'failed'] as const;
export type RateImportState = (typeof RATE_IMPORT_STATES)[number];

/** MPC (maximum production capacity) is the sustained capacity of §3.1. */
export const IMPORT_RATE_KIND: Readonly<Record<RateImportKind, RateKind>> = {
  budget: 'budget',
  forecast: 'forecast',
  mpc: 'sustained',
};

/** Half-open validity `[from, to)`; `to` null = open-ended. */
export interface Validity {
  from: Date;
  to: Date | null;
}

/** One stored version of a versioned row (profile, rate or valuation rate). */
export interface VersionRef extends Validity {
  id: string;
  version: number;
}
