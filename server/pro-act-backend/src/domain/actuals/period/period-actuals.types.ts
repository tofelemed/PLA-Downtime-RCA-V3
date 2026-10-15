import { Dec } from '../decimal';
import type { QualityClasses } from './quality-classes';

/**
 * Types of the period actuals engine (plan 2.4, spec ACT01–ACT08, SRC01, D05). Pure data: the service
 * layer loads events, samples, adjustments and report lines and passes them in; nothing here reads the
 * database. Quantities are decimals (decimal.js), instants `Date`, durations seconds.
 */

/** `coverage_gate` policy body (contracts/policies/coverage_gate.schema.json, ACT05). */
export interface CoverageGatePolicy {
  requiredCoverageRatio: number;
  allowProportionalEstimate: boolean;
  countApprovedSubstitutionsAsAccepted: boolean;
}

export const ACTUALS_SOURCES = [
  'pi_output_ef',
  'pi_counter',
  'pi_rate',
  'mqtt',
  'kafka',
  'manual',
  'external_report',
] as const;
export type ActualsSource = (typeof ACTUALS_SOURCES)[number];

export type FallbackCondition =
  | 'primary_stale'
  | 'primary_bad_quality'
  | 'primary_missing'
  | 'primary_conflict';

/** `source_authority` policy body (contracts/policies/source_authority.schema.json, SRC01, D05). */
export interface SourceAuthorityPolicy {
  measurement: 'output' | 'state' | 'rate';
  productId: string | null;
  primarySource: ActualsSource;
  fallback: { conditions: FallbackCondition[]; source: ActualsSource } | null;
  cadenceSeconds: number;
  conflictTolerance: number;
  overrideRole: string;
  /** SME E7 ranked sources at one measurement boundary; absent = primary then fallback (older versions) */
  measurementHierarchy?: MeasurementHierarchy;
}

/**
 * SME E7 source classes, best first: a calibrated primary totalizer, a qualified redundant measurement,
 * a reconciled production / inventory record, an explicitly approved estimate (never a forecast).
 */
export const SOURCE_CLASSES = [
  'calibrated_primary',
  'redundant_measurement',
  'reconciled_record',
  'approved_estimate',
] as const;
export type SourceClass = (typeof SOURCE_CLASSES)[number];

/**
 * How a source at another boundary is brought to the slice's boundary (E7: a packing total stands for
 * reactor output only after the silo stock change and the time lag are accounted for). `lagSeconds`
 * shifts the source's window later (signal sources only); `inventoryChangeAccounted` false = the plant
 * knows the record but it is not a substitute (`boundary_mismatch` whenever it would have been needed).
 */
export interface BoundaryAdjustment {
  inventoryChangeAccounted: boolean;
  lagSeconds: number;
  evidenceRef: string;
}

/** One ranked source of the hierarchy; `signalSourceKey` picks one signal (a redundant meter of the same type). */
export interface HierarchyEntry {
  rank: number;
  sourceClass: SourceClass | null;
  source: ActualsSource;
  signalSourceKey: string | null;
  boundary: string | null;
  boundaryAdjustment: BoundaryAdjustment | null;
}

/** SME E7: the slice's measurement boundary, when a lower rank may step in, and the ranked sources. */
export interface MeasurementHierarchy {
  boundary: string | null;
  conditions: FallbackCondition[];
  entries: HierarchyEntry[];
}

/** A ranked source as the provenance names it. */
export interface RankedSourceRef {
  rank: number;
  sourceClass: SourceClass | null;
  source: ActualsSource;
  boundary: string | null;
}

/**
 * SME E7 substitution flag of a slice: a lower-ranked source (or the approved estimate) gave the
 * actuals instead of the top-ranked source, why, and how another boundary was bridged.
 */
export interface SourceSubstitution {
  used: RankedSourceRef & { label: string };
  replaced: RankedSourceRef;
  reason: FallbackCondition | 'no_measured_source';
  crossBoundary: {
    fromBoundary: string | null;
    lagSeconds: number;
    evidenceRef: string;
  } | null;
}

export const ACTUALS_METHODS = [
  'output_events',
  'counter_delta',
  'rate_integration',
  'manual',
  'external_report',
  'mixed',
] as const;
export type ActualsMethod = (typeof ACTUALS_METHODS)[number];

export const QUALITY_STATES = [
  'complete',
  'partial',
  'missing',
  'conflict',
] as const;
export type QualityState = (typeof QUALITY_STATES)[number];

export type QuantityBasis = 'gross' | 'good';

/** Half-open `[from, to)`. */
export interface Window {
  from: Date;
  to: Date;
}

/**
 * Something the engine wants a reviewer to see. `problem` findings make the slice partial (or worse);
 * `info` findings (fallback used, estimate applied) are recorded but do not lower the quality state.
 */
export interface PeriodFinding {
  code: string;
  severity: 'problem' | 'info';
  from?: string;
  to?: string;
  detail?: Record<string, unknown>;
}

/** One provenance piece of a result (persisted as `source_segments`). */
export interface SourceSegment {
  source: string;
  from: string;
  to: string;
  quantity: string | null;
  method: string;
  quality: 'measured' | 'estimated' | 'excluded' | 'missing';
}

/**
 * What one source says about a window, before authority selection. `observed` are the intervals the
 * source covers with accepted evidence (coverage); `available` is false when the source has no data at
 * all for the window (the `primary_missing` fallback condition).
 */
export interface SourceCandidate {
  source: ActualsSource;
  method: Exclude<ActualsMethod, 'manual' | 'mixed'>;
  label: string;
  basis: QuantityBasis;
  /** gross when basis gross, good when basis good; null = not quantifiable */
  quantity: Dec | null;
  reject: Dec | null;
  measured: Dec;
  estimated: Dec;
  uom: string | null;
  available: boolean;
  observed: Array<{ start: Date; end: Date }>;
  segments: SourceSegment[];
  findings: PeriodFinding[];
}

export type AdjustmentKind = 'gross' | 'good' | 'reject' | 'rework';

/** An approved manual adjustment of a slice (ACT06), applied as a separate component. */
export interface ApprovedAdjustment {
  id: string;
  kind: AdjustmentKind;
  quantity: Dec;
  basis: 'measured' | 'estimated';
  window: Window | null;
}

/** The persisted actuals of one slice (`actuals_results`). */
export interface SliceActuals {
  gross: string | null;
  good: string | null;
  reject: string | null;
  reworkAccepted: string | null;
  uom: string | null;
  basis: QuantityBasis;
  method: ActualsMethod | null;
  coverageRatio: string | null;
  measuredQty: string | null;
  estimatedQty: string | null;
  qualityState: QualityState;
  sourceSegments: SourceSegment[];
  findings: PeriodFinding[];
  coverage: {
    windowSeconds: number;
    observedSeconds: number;
    substitutedSeconds: number;
  };
  adjustmentIds: string[];
  /** SME E3 class breakdown; null / absent = no disposition and no rework acceptance (older results) */
  qualityClasses?: QualityClasses | null;
  /** SME E7: set when a lower-ranked source or the approved estimate was used (actuals 2.4.3); absent = older */
  substitution?: SourceSubstitution | null;
}
