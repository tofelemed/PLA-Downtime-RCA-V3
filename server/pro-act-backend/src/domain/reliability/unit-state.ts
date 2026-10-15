import { BoundedInterval } from '../time/interval-algebra';
import {
  AnalogBand,
  analogBand,
  AnalogThresholds,
  analogValue,
} from './analog-state';

/**
 * SME D1: the physical states of a unit (one primary bucket at every instant). `reduced_rate` (DT01, plan
 * 1.10) is running below the reduced-rate threshold: running time whose loss is performance, never a stop.
 */
export const PHYSICAL_STATES = [
  'running',
  'reduced_rate',
  'internal_stop',
  'planned_stop',
  'starved',
  'blocked',
  'standby',
  'not_scheduled',
] as const;
export type PhysicalState = (typeof PHYSICAL_STATES)[number];

/** Why an instant is unknown: a data-quality condition, never a running / stopped guess (SME D2). */
export type UnknownReason =
  | 'no_data'
  | 'stale'
  | 'bad_quality'
  | 'uncertain_quality'
  | 'unmapped';

/** One mapping rule: a signal value (state name or code, compared as text without case) → state. */
export interface StateRule {
  match: string;
  state: PhysicalState;
}

export interface StateConfig {
  rules: readonly StateRule[];
  expectedIntervalSeconds: number;
  jitterSeconds: number;
  staleAfterIntervals: number;
  /**
   * true = periodic heartbeat source: a sample older than the stale limit is unknown time. false = an
   * exception-based source (a quiet historian is not lost communication): a sample holds until the next.
   */
  heartbeat: boolean;
  /** the signal's quality policy: uncertain samples count only when accepted */
  acceptUncertain: boolean;
  /** plan 1.10 analog mapping: a numeric value no rule matches is banded by thresholds; absent = none */
  thresholds?: AnalogThresholds | null;
}

export interface StateSample {
  at: Date;
  /** state name, else the state / numeric value as text; null = no value */
  value: string | null;
  quality: 'good' | 'uncertain' | 'bad' | 'missing';
}

export interface StateSegment {
  start: Date;
  end: Date;
  state: PhysicalState | 'unknown';
  unknownReason: UnknownReason | null;
}

/** Seconds after a heartbeat sample until it is stale: 3 intervals + jitter by default (SME D2 pilot). */
export function staleLimitSeconds(config: StateConfig): number {
  return (
    config.staleAfterIntervals * config.expectedIntervalSeconds +
    config.jitterSeconds
  );
}

type SampleState = Pick<StateSegment, 'state' | 'unknownReason'> & {
  /** the analog band, when thresholds decided the state */
  band: AnalogBand | null;
};

const bandStates = (
  t: AnalogThresholds,
): Readonly<Record<AnalogBand, PhysicalState>> => ({
  stopped: t.stopState,
  reduced_rate: 'reduced_rate',
  running: 'running',
});

/** A rule match wins; else a numeric value is banded by the thresholds (with the previous band). */
function stateOf(
  sample: StateSample,
  config: StateConfig,
  previous: AnalogBand | null,
): SampleState {
  const unknown = (unknownReason: UnknownReason) => ({
    state: 'unknown' as const,
    unknownReason,
    band: null,
  });
  if (sample.quality === 'bad' || sample.quality === 'missing') {
    return unknown('bad_quality');
  }
  if (sample.quality === 'uncertain' && !config.acceptUncertain) {
    return unknown('uncertain_quality');
  }
  const value = sample.value?.trim().toLowerCase();
  const rule = config.rules.find((r) => r.match.trim().toLowerCase() === value);
  if (rule) return { state: rule.state, unknownReason: null, band: null };
  const thresholds = config.thresholds;
  const numeric = analogValue(sample.value);
  if (!thresholds || numeric === null) return unknown('unmapped');
  const band = analogBand(numeric, thresholds, previous);
  return { state: bandStates(thresholds)[band], unknownReason: null, band };
}

function push(segments: StateSegment[], next: StateSegment): void {
  if (next.end <= next.start) return;
  const last = segments[segments.length - 1];
  if (
    last &&
    last.end.getTime() === next.start.getTime() &&
    last.state === next.state &&
    last.unknownReason === next.unknownReason
  ) {
    last.end = next.end;
    return;
  }
  segments.push({ ...next });
}

const later = (a: Date, b: Date) => (a > b ? a : b);
const earlier = (a: Date, b: Date) => (a < b ? a : b);

/**
 * The unit's state timeline over the window from its samples (SME D1 / D2): each sample's mapped state
 * holds until the next sample, a heartbeat sample only up to the stale limit; bad quality is unknown at
 * once; time before the first sample is unknown (`no_data`). Gaps are never filled. With analog thresholds,
 * the band of each numeric sample depends on the previous sample's band (hysteresis); the bands of samples
 * before the window are carried in, a non-analog sample resets it. `samples` may start
 * before the window (the last sample before it decides the state at the window start).
 */
export function stateTimeline(
  samples: readonly StateSample[],
  config: StateConfig,
  window: BoundedInterval,
): StateSegment[] {
  const sorted = [...samples].sort((a, b) => a.at.getTime() - b.at.getTime());
  const segments: StateSegment[] = [];
  const limitMs = staleLimitSeconds(config) * 1000;
  let cursor = window.start;
  let band: AnalogBand | null = null;
  sorted.forEach((sample, i) => {
    const mapped = stateOf(sample, config, band);
    band = mapped.band;
    const next = sorted[i + 1]?.at ?? window.end;
    const until = earlier(next, window.end);
    if (until <= window.start || sample.at >= window.end) return;
    const from = later(sample.at, window.start);
    if (from > cursor) {
      push(segments, {
        start: cursor,
        end: from,
        state: 'unknown',
        unknownReason: 'no_data',
      });
    }
    const holds = config.heartbeat
      ? new Date(sample.at.getTime() + limitMs)
      : until;
    const known = earlier(holds, until);
    push(segments, {
      start: from,
      end: later(known, from),
      state: mapped.state,
      unknownReason: mapped.unknownReason,
    });
    push(segments, {
      start: later(known, from),
      end: until,
      state: 'unknown',
      unknownReason: 'stale',
    });
    cursor = later(cursor, until);
  });
  if (cursor < window.end) {
    const reason = sorted.length === 0 ? 'no_data' : 'stale';
    push(segments, {
      start: cursor,
      end: window.end,
      state: 'unknown',
      unknownReason: reason,
    });
  }
  return segments;
}
