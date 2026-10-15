import {
  analogBand,
  AnalogThresholds,
} from '../../src/domain/reliability/analog-state';
import {
  deriveSlowdowns,
  describeSlowdown,
} from '../../src/domain/reliability/derived-slowdowns';
import {
  deriveStops,
  STOP_DERIVATION_DEFAULTS,
} from '../../src/domain/reliability/derived-stops';
import { stateCoverage } from '../../src/domain/reliability/state-coverage';
import {
  StateConfig,
  StateSample,
  stateTimeline,
} from '../../src/domain/reliability/unit-state';

/**
 * Plan 1.10 analog thresholds with hysteresis and reduced-rate segments (DT01 / DT02 / DT03): an extruder
 * throughput signal (t/h, rated 20) every 1 s — stopped below 2, reduced rate below 16, hysteresis 0.5. A
 * value hovering at 16 does not flap; a 3 s dip below 2 is no stop (debounce 5 s) while 90 s is one; ten
 * minutes at 15 t/h is one slowdown losing 25 % of the rate (performance, never a stop), a 5 s recovery
 * inside it does not end it (restart confirmation 10 s); reduced-rate time is running time in the coverage.
 */
const T0 = Date.UTC(2027, 2, 1, 6, 0, 0);
const at = (seconds: number) => new Date(T0 + seconds * 1000);

const THRESHOLDS: AnalogThresholds = {
  stopBelow: 2,
  reducedBelow: 16,
  hysteresis: 0.5,
  stopState: 'internal_stop',
  ratedValue: 20,
};

const CONFIG: StateConfig = {
  rules: [],
  expectedIntervalSeconds: 1,
  jitterSeconds: 0,
  staleAfterIntervals: 3,
  heartbeat: true,
  acceptUncertain: false,
  thresholds: THRESHOLDS,
};

/** One sample per second from `from` for `seconds` at `value`. */
const run = (from: number, seconds: number, value: number): StateSample[] =>
  Array.from({ length: seconds }, (_, i) => ({
    at: at(from + i),
    value: String(value),
    quality: 'good' as const,
  }));

const timeline = (samples: StateSample[], end: number) =>
  stateTimeline(samples, CONFIG, { start: at(0), end: at(end) });

describe('analog thresholds with hysteresis (plan 1.10)', () => {
  it('a band is entered below its threshold and left only above threshold + hysteresis', () => {
    expect(analogBand(20, THRESHOLDS, null)).toBe('running');
    expect(analogBand(15.9, THRESHOLDS, 'running')).toBe('reduced_rate');
    expect(analogBand(16.2, THRESHOLDS, 'reduced_rate')).toBe('reduced_rate');
    expect(analogBand(16.5, THRESHOLDS, 'reduced_rate')).toBe('running');
    expect(analogBand(1.5, THRESHOLDS, 'reduced_rate')).toBe('stopped');
    expect(analogBand(2.3, THRESHOLDS, 'stopped')).toBe('stopped');
    expect(analogBand(2.6, THRESHOLDS, 'stopped')).toBe('reduced_rate');
    expect(analogBand(18, THRESHOLDS, 'stopped')).toBe('running');
    expect(analogBand(16.2, THRESHOLDS, null)).toBe('running');
  });

  it('a value hovering at the reduced-rate threshold does not flap', () => {
    const hover = [15.9, 16.1, 15.95, 16.3, 15.99, 16.2].flatMap((v, i) =>
      run(i * 10, 10, v),
    );
    const states = timeline(hover, 60).map((s) => s.state);
    expect(states).toEqual(['reduced_rate']);
  });

  it('debounce as for discrete states: a 3 s dip is no stop, 90 s is one stop of internal stop', () => {
    const dip = [...run(0, 60, 20), ...run(60, 3, 1), ...run(63, 60, 20)];
    expect(
      deriveStops(timeline(dip, 123), STOP_DERIVATION_DEFAULTS, null),
    ).toEqual([]);
    const stop = [...run(0, 60, 20), ...run(60, 90, 0.5), ...run(150, 60, 20)];
    const stops = deriveStops(
      timeline(stop, 210),
      STOP_DERIVATION_DEFAULTS,
      null,
    );
    expect(stops).toHaveLength(1);
    expect(stops[0]).toMatchObject({ state: 'internal_stop', start: at(60) });
    // leaving the stop needs 2.5 t/h: the first sample at 20 t/h ends it, the confirmation is never added
    expect(stops[0].end).toEqual(at(150));
  });

  it('ten minutes at 15 t/h is one slowdown losing 25 % of the rate, never a stop', () => {
    const samples = [
      ...run(0, 60, 20),
      ...run(60, 600, 15),
      ...run(660, 60, 20),
    ];
    const segments = timeline(samples, 720);
    expect(deriveStops(segments, STOP_DERIVATION_DEFAULTS, null)).toEqual([]);
    const slowdowns = deriveSlowdowns(segments, samples, {
      config: STOP_DERIVATION_DEFAULTS,
      ratedValue: 20,
      liveEdge: null,
    });
    expect(slowdowns).toEqual([
      {
        key: `reduced_rate@${at(60).getTime()}`,
        occurrenceKey: `reduced_rate@${at(60).getTime()}`,
        start: at(60),
        end: at(660),
        meanValue: 15,
        fraction: '0.25',
      },
    ]);
    expect(describeSlowdown(slowdowns[0])).toBe(
      'State engine: reduced rate (mean signal 15, 25 % of the rate lost)',
    );
  });

  it('a 5 s recovery inside a slowdown does not end it; a 3 s reduced blip is none; open at the live edge', () => {
    const samples = [
      ...run(0, 120, 14),
      ...run(120, 5, 19),
      ...run(125, 120, 14),
      ...run(245, 30, 20),
      ...run(275, 3, 15),
      ...run(278, 30, 20),
      ...run(308, 60, 12),
    ];
    const slowdowns = deriveSlowdowns(timeline(samples, 368), samples, {
      config: STOP_DERIVATION_DEFAULTS,
      ratedValue: null,
      liveEdge: at(368),
    });
    expect(slowdowns.map((s) => [s.start, s.end, s.fraction])).toEqual([
      [at(0), at(245), null],
      [at(308), null, null],
    ]);
  });

  it('reduced-rate time counts as running time in the coverage and availability bounds', () => {
    const samples = [...run(0, 60, 20), ...run(60, 60, 15), ...run(120, 60, 0)];
    const coverage = stateCoverage(timeline(samples, 180), [
      { start: at(0), end: at(180) },
    ]);
    expect(coverage).toMatchObject({
      runningSeconds: 120,
      knownStoppedSeconds: 60,
      availabilityLower: 120 / 180,
    });
  });
});
