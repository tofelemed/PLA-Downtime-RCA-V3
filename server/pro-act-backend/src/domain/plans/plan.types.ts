/**
 * Vocabulary of plan versions and plan periods (plan 2.3, PLAN02–PLAN05, spec §14.2 `plan_versions`,
 * `plan_product_slices`, `plan_periods`). A plan header owns versions; the approved version's periods are
 * the plan-ledger baseline (D04). Quantities are decimal strings at 8 places; durations are seconds.
 */
export const PLAN_BASES = ['time', 'quantity', 'manual'] as const;
export type PlanBasis = (typeof PLAN_BASES)[number];

export const TARGET_SOURCES = ['generated', 'entered', 'imported'] as const;
export type TargetSource = (typeof TARGET_SOURCES)[number];

export const DISTRIBUTIONS = [
  'scheduled_capacity',
  'explicit_weights',
  'equal',
] as const;
export type Distribution = (typeof DISTRIBUTIONS)[number];

export const APPROVAL_STATES = [
  'draft',
  'submitted',
  'approved',
  'superseded',
] as const;
export type ApprovalState = (typeof APPROVAL_STATES)[number];

/** Versions whose content may still change (at most one per plan). */
export const OPEN_STATES: readonly ApprovalState[] = ['draft', 'submitted'];

/** sequential = campaigns one after another (D14 default); the others need CONCURRENT_PRODUCTS. */
export const SLICE_STREAMS = ['sequential', 'independent', 'shared'] as const;
export type SliceStream = (typeof SLICE_STREAMS)[number];

export const GENERATION_JOB_STATES = [
  'queued',
  'running',
  'completed',
  'failed',
] as const;
export type GenerationJobState = (typeof GENERATION_JOB_STATES)[number];

/** A refusal of the generator (422 at the API) with a stable code. */
export class PlanGenerationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'PlanGenerationError';
  }
}

/** One leaf window (a stored shift instance, clipped to the plan window). */
export interface PlanLeaf {
  shiftInstanceId: string | null;
  calendarVersionId: string | null;
  localDate: string;
  shiftName: string;
  start: Date;
  end: Date;
  isExcluded: boolean;
  exclusionKind: string | null;
  /** UTC offsets at start and end differ (DST inside the leaf) */
  offsetChanges: boolean;
  /** the stored instance was cut by the plan window */
  clipped: boolean;
}

/** A rate in force for a leaf, as quantity per second. */
export interface ResolvedRate {
  id: string;
  perSecond: string;
}

/** What the profile domain says about one slice at one leaf. */
export interface LeafRates {
  profileId: string | null;
  quantityUom: string | null;
  planning: ResolvedRate | null;
  sustained: ResolvedRate | null;
  /** share of the shared capacity from the joint recipe (shared streams only) */
  recipeShare: string | null;
  /** a rate version starts or ends strictly inside the leaf */
  rateChangesInside: boolean;
}

export interface SliceInput {
  key: string;
  productId: string;
  stream: SliceStream;
  /** half-open campaign; null bounds = the whole plan */
  campaignFrom: Date | null;
  campaignTo: Date | null;
  weight: string | null;
  target: string | null;
}

export interface ManualTarget {
  sliceKey: string;
  utcStart: Date;
  target: string;
}

export interface GenerationInput {
  basis: PlanBasis;
  distribution: Distribution;
  headerTarget: string | null;
  slices: readonly SliceInput[];
  leaves: readonly PlanLeaf[];
  /** pre-resolved rates of a slice at a leaf (pure lookup, no I/O) */
  ratesAt: (slice: SliceInput, leaf: PlanLeaf) => LeafRates;
  manualTargets: readonly ManualTarget[];
  concurrentProductsEnabled: boolean;
  window: { start: Date; end: Date };
}

export interface GeneratedPeriod {
  sliceKey: string;
  productId: string;
  leaf: PlanLeaf;
  scheduledSeconds: number;
  target: string;
  planningCapacity: string | null;
  sustainedCapacity: string | null;
  rates: LeafRates;
}

export const PLAN_WARNING_CODES = [
  'excluded_leaf',
  'dst_leaf',
  'clipped_leaf',
  'missing_profile',
  'missing_planning_rate',
  'missing_sustained_rate',
  'rate_change_inside_leaf',
  'campaign_boundary_inside_leaf',
  'unassigned_leaf',
  'unscheduled_time',
] as const;
export type PlanWarningCode = (typeof PLAN_WARNING_CODES)[number];

export interface PlanWarning {
  code: PlanWarningCode;
  /** leaf start (ISO) when the warning is about one leaf */
  at?: string;
  sliceKey?: string;
  detail?: string;
}

/** Σ targets per quantity unit: unlike units are never added together (PLAN05). */
export interface UomTotal {
  quantityUom: string | null;
  target: string;
}

export interface GenerationResult {
  periods: GeneratedPeriod[];
  /** the header target (Σ of all targets) when every slice shares one quantity unit, else null */
  headerTarget: string | null;
  totals: UomTotal[];
  warnings: PlanWarning[];
}
