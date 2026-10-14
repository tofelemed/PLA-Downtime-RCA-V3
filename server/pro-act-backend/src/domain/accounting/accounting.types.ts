import { RateTimebase } from '../actuals/actuals.types';
import { Dec } from '../actuals/decimal';
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

export type LossEventType = 'downtime' | 'slowdown' | 'quality_loss';

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
}

/** The actuals of a slice (2.4 result of the run's actuals run). */
export interface SliceActualsInput {
  gross: string | null;
  good: string | null;
  uom: string | null;
  /** 2.4 quality state and coverage (plan 2.7 data quality); absent in 2.5 fixtures */
  qualityState?: string | null;
  coverageRatio?: string | null;
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

export interface EnginePolicy {
  /** absent = `equal_share` (the rule of every policy version written before the option existed) */
  overlapAllocation?: OverlapAllocation;
  microStopSeconds: number;
  derateComponent: 'performance' | 'availability';
  plannedStopsInsideScheduleReduceAvailability: boolean;
  epsilon: string;
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
