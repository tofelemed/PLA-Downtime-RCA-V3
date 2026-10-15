import { RateTimebase } from '../actuals/actuals.types';
import { Dec } from '../actuals/decimal';
import { QualityClasses } from '../actuals/period/quality-classes';
import { BoundedInterval } from '../time/interval-algebra';

/** The two loss ledgers of ACC01 (distinct baselines). */
export const LEDGERS = ['capacity', 'plan'] as const;
export type Ledger = (typeof LEDGERS)[number];

export const LOSS_KINDS = [
  'schedule_exclusion',
  'availability',
  'performance',
  'quality',
  'residual',
  'gain',
  'tolerance_adjustment',
  'unaccounted_classified',
  'bridge',
  /** LA-08: transition loss within the approved transition standard (planned allowance) */
  'transition_allowance',
  /** LA-08: transition loss beyond the standard (`transition_overrun`) or without one (`no_transition_standard`) */
  'transition_excess',
] as const;
export type LossKind = (typeof LOSS_KINDS)[number];

/** Kinds that may carry a negative quantity (ACC01: residual signed, never clamped). */
export const SIGNED_KINDS: ReadonlySet<LossKind> = new Set([
  'residual',
  'gain',
  'bridge',
]);

export const LOSS_BASES = [
  'sustained_rate',
  'planning_rate',
  'measured',
  'declared',
] as const;
export type LossBasis = (typeof LOSS_BASES)[number];

/** An approved rate version in force over `[from, to)` (to null = open). */
export interface RateVersion {
  id: string;
  rate: string;
  timebase: RateTimebase;
  from: Date;
  to: Date | null;
}

/** A stored shift instance overlapping the period (excluded = schedule-exclusion bucket). */
export interface ScheduleSpan {
  start: Date;
  end: Date;
  excluded: boolean;
  exclusionKind: string | null;
}

export type LossEventType =
  | 'downtime'
  | 'slowdown'
  | 'quality_loss'
  | 'grade_transition';

/** The product change a `grade_transition` event records (directional: from → to). */
export interface GradeChange {
  fromProductId: string;
  toProductId: string;
  /** SME E1: catalyst family of the change (event, else unknown); absent / null = not recorded */
  catalystFamily?: string | null;
  /** SME E1: operating mode of the change (event, else the production context's profile mode) */
  operatingMode?: string | null;
}

/**
 * An approved, effective-dated entry of the unit's transition matrix (SME E1): the reference duration
 * of one directional product change and, optionally, the reference off-grade quantity it makes.
 */
export interface TransitionStandard {
  id: string;
  fromProductId: string;
  toProductId: string;
  referenceSeconds: string;
  referenceOffgradeQuantity: string | null;
  /** SME E1: catalyst family the entry applies to; absent / null = any */
  catalystFamily?: string | null;
  /** SME E1: operating mode the entry applies to; absent / null = any */
  operatingMode?: string | null;
  from: Date;
  to: Date | null;
}

/** A loss-explaining event revision effective at run time (evidence of ACC05). */
export interface LossEvent {
  eventId: string;
  /** `event_revisions.id` of the latest revision; null for events that never had one */
  revisionId: string | null;
  revision: number | null;
  occurrenceId: string;
  physicalType: LossEventType;
  start: Date;
  end: Date | null;
  scheduleClass: string;
  oeeComponent: string;
  impactMode: string;
  impactFraction: string | null;
  quantity: string | null;
  reasonCodeId: string | null;
  impactCodeId: string | null;
  failureMode: string | null;
  /** asset of the event (plan 2.7 breakdowns); absent in 2.5 fixtures */
  assetId?: string | null;
  /**
   * SME D4: approved end of a planned stop's window, frozen before the work; time after it is an unplanned
   * extension of the same stop (maintenance overrun). Null = no approved window recorded.
   */
  plannedEnd?: Date | null;
  /** LA-08: products of a `grade_transition` event; absent / null for every other event */
  transition?: GradeChange | null;
  /** SME Q10: the stop this ramp-up / startup-quality event recovers from (its lines name that stop) */
  recoveryOfEventId?: string | null;
  /** SME D6: asset type of the event's asset (micro-stop threshold per asset class); absent in older fixtures */
  assetClass?: string | null;
  /** SME D6: code of the reason (a trip reason is never a micro-stop) */
  reasonCode?: string | null;
  /** SME D8: failure severity (a functional failure is never a micro-stop) */
  failureSeverity?: string | null;
  /** SME E3: disposition class of a `quality_loss` event (downgrade / scrap / rework); absent = none */
  dispositionClass?: string | null;
}

/** The actuals of a slice (2.4 result of the run's actuals run). */
export interface SliceActualsInput {
  gross: string | null;
  good: string | null;
  uom: string | null;
  /** 2.4 quality state and coverage (plan 2.7 data quality); absent in 2.5 fixtures */
  qualityState?: string | null;
  coverageRatio?: string | null;
  /** SME E3: the slice's disposition class breakdown (actuals 2.4.2); absent / null = none */
  classes?: QualityClasses | null;
}

export interface SliceInput {
  sliceId: string;
  window: BoundedInterval;
  uom: string | null;
  /** null = the slice has no profile */
  sustainedRates: RateVersion[] | null;
  planningRates: RateVersion[];
  /** plan period target of the slice; null = no plan */
  target: string | null;
  actuals: SliceActualsInput | null;
  /** another slice shares the same window (concurrent products) */
  concurrent: boolean;
  /** product of the slice (plan 2.7 KPI scope); absent in 2.5 fixtures */
  productId?: string;
}

/** `oee_policy` (D04) and `reconciliation_tolerance` (D06) values the engine applies. */
/**
 * How overlapping stops share a segment (SME Q11: allocate once, by a stated rule): `equal_share` splits
 * it equally between the causes; `first_out` gives it to the cause that started first.
 */
export type OverlapAllocation = 'equal_share' | 'first_out';

/**
 * Whether the plan target already allows for grade transitions within their approved standard (LA-08,
 * ISO 22400 / GE PLA: a planned grade change within its standard is planned time): `planned` = the plan
 * deducted the standard transition time, so the allowance is no plan-ledger loss (only the overrun is);
 * `loss` = the plan did not, so the allowance explains part of the plan gap. The capacity ledger shows
 * both either way.
 */
export type TransitionAllowanceInPlan = 'planned' | 'loss';

export interface EnginePolicy {
  /** absent = `equal_share` (the rule of every policy version written before the option existed) */
  overlapAllocation?: OverlapAllocation;
  microStopSeconds: number;
  /** SME D6: threshold per asset class (asset type), overriding `microStopSeconds`; absent = unit threshold only */
  microStopSecondsByAssetClass?: Readonly<Record<string, number>>;
  /** SME D6: reason codes of process trips, always availability events whatever their length */
  tripReasonCodes?: readonly string[];
  derateComponent: 'performance' | 'availability';
  plannedStopsInsideScheduleReduceAvailability: boolean;
  epsilon: string;
  /** absent = `loss` (the rule of every policy version written before the option existed) */
  transitionAllowanceInPlan?: TransitionAllowanceInPlan;
}

export interface PeriodAccountingInput {
  window: BoundedInterval;
  periodExcluded: boolean;
  periodExclusionKind: string | null;
  schedule: ScheduleSpan[];
  events: LossEvent[];
  slices: SliceInput[];
  /** running events are measured to here (≤ period end) */
  asOf: Date;
  policy: EnginePolicy;
  /** LA-08: the unit's approved transition standards overlapping the period; absent = none */
  transitionStandards?: readonly TransitionStandard[];
  /**
   * full extent of each stop occurrence over all its events, also those outside the window (DT-09):
   * a split child inside the window is a micro-stop only if the whole occurrence is short
   */
  occurrences?: ReadonlyArray<{
    occurrenceId: string;
    start: Date;
    end: Date | null;
  }>;
}

/** One cause of a segment with its share (Σ shares of a segment = 1). */
export interface SegmentCause {
  event: LossEvent;
  share: Dec;
}

/** Atomic segment: no schedule, stop, rate or claim boundary inside it (ACC02). */
export interface Segment {
  start: Date;
  end: Date;
  seconds: Dec;
  excluded: boolean;
  exclusionKind: string | null;
  sustained: RateVersion | null;
  planning: RateVersion | null;
  /** availability stops (≥ micro-stop threshold), one cause per occurrence */
  stops: SegmentCause[];
  /** micro-stops (performance) active in the segment */
  microStops: SegmentCause[];
  /** fractional derates active in the segment */
  derates: LossEvent[];
  /** grade transitions active in running time (they take the segment's capacity, LA-08) */
  transitions: SegmentCause[];
}

export interface EvidenceDraft {
  eventId: string;
  eventRevisionId: string | null;
  occurrenceId: string;
  share: string;
  clippedStart: Date;
  clippedEnd: Date;
}

export interface LossLineDraft {
  ledger: Ledger;
  kind: LossKind;
  sliceId: string;
  segmentStart: Date;
  segmentEnd: Date;
  quantity: Dec;
  uom: string | null;
  basis: LossBasis;
  rateVersionId: string | null;
  cause: LossEvent | null;
  scheduleClass: string | null;
  oeeComponent: string | null;
  flags: string[];
  evidence: EvidenceDraft[];
  autoKey: string;
}

/** Totals of one slice and ledger (`period_ledger_totals`); null = not computable. */
export interface LedgerTotals {
  sliceId: string;
  ledger: Ledger;
  uom: string | null;
  capacity: Dec | null;
  exclusion: Dec | null;
  availability: Dec | null;
  performance: Dec | null;
  quality: Dec | null;
  good: Dec | null;
  gain: Dec | null;
  attributed: Dec | null;
  residual: Dec | null;
  target: Dec | null;
  actual: Dec | null;
  gap: Dec | null;
  overproduction: Dec | null;
  overAccounted: Dec | null;
  /**
   * Plan ledger with `transitionAllowanceInPlan = planned`: Σ transition allowance (within the standard)
   * the plan target already allows for — information, not a loss line. Null otherwise.
   */
  plannedTransition: Dec | null;
  flags: string[];
}

export interface ValidationIssue {
  code: string;
  message: string;
  sliceId: string | null;
}

export interface PeriodAccounting {
  lines: LossLineDraft[];
  totals: LedgerTotals[];
  issues: ValidationIssue[];
  segmentCount: number;
}
