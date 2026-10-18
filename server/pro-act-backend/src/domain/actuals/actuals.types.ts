/**
 * Inputs and results of the quantity engine (plan 1.7, spec ACT02–ACT05, PI09). Pure data: the engine
 * never reads the database; callers (preview now, the period engine in 2.4) load samples and pass them in.
 * Quantities cross the boundary as decimal strings; durations are seconds.
 */
export type SampleQuality = 'good' | 'uncertain' | 'bad' | 'missing';
export type Interpolation = 'step' | 'linear';
export type RateTimebase = 's' | 'min' | 'h' | 'd';
export type ResetPolicy = 'none' | 'known_instant' | 'detect_drop';

/** One stored sample (latest revision of signal + timestamp). */
export interface EngineSample {
  at: Date;
  /** numeric value as stored (decimal string or number); null for state-only samples */
  value: string | number | null;
  quality: SampleQuality;
}

/** The signal configuration the engine needs (a subset of `signals`). */
export interface EngineSignal {
  semanticType: string;
  interpolation: Interpolation;
  maxGapSeconds: number;
  rateTimebase?: RateTimebase | null;
  resetPolicy?: ResetPolicy;
  rolloverModulus?: string | null;
  expectedMin?: string | null;
  /** rate signals: maximum credible value; counters: maximum credible increase per `rateTimebase` */
  expectedMax?: string | null;
  /** quality policy: `uncertain` samples are used only when true (default: good only) */
  acceptUncertain?: boolean;
  canonicalUom?: string | null;
}

/** Half-open `[from, to)`. */
export interface TimeWindow {
  from: Date;
  to: Date;
}

export type EngineExceptionCode =
  | 'invalid_window'
  | 'wrong_semantic_type'
  | 'missing_timebase'
  | 'rate_uom_timebase_mismatch'
  | 'no_data'
  | 'gap'
  | 'bad_quality'
  | 'out_of_range'
  | 'reset_unresolved'
  | 'rate_implausible'
  | 'spanning_event'
  | 'negative_output';

export interface EngineException {
  code: EngineExceptionCode;
  from?: string;
  to?: string;
  detail?: Record<string, unknown>;
}

export type SegmentKind =
  | 'delta'
  | 'reset'
  | 'rollover'
  | 'gap'
  | 'unresolved'
  | 'integral'
  | 'excluded';

/** One piece of the window and what it contributed. */
export interface QuantitySegment {
  from: string;
  to: string;
  kind: SegmentKind;
  /** contribution to `quantity` (null = not counted) */
  quantity: string | null;
  /** measured = both ends are readings; estimated = an end was interpolated at the window boundary */
  basis: 'measured' | 'estimated' | null;
}

/** Coverage of the window (ACT05 inputs); `ratio = observedSeconds / windowSeconds`. */
export interface Coverage {
  windowSeconds: number;
  observedSeconds: number;
  measuredSeconds: number;
  estimatedSeconds: number;
  missingSeconds: number;
  excludedSeconds: number;
  ratio: string;
}

/** How a quantity was obtained (persisted with period results in 2.4). */
export interface QuantityMethod {
  name: string;
  interpolation: Interpolation;
  /** rate integration: `value × Δt / timebaseSeconds` */
  timebase?: RateTimebase | null;
  timebaseSeconds?: number | null;
  uom: string | null;
}

export interface QuantityResult {
  /** null when the window cannot be quantified (unresolved reset, no data, configuration error) */
  quantity: string | null;
  method: QuantityMethod;
  qualityState: 'complete' | 'incomplete';
  segments: QuantitySegment[];
  exceptions: EngineException[];
  coverage: Coverage;
}
