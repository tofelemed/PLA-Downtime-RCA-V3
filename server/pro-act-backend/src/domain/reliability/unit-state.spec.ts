import { scheduledIntervals, stateCoverage } from './state-coverage';
import { StateConfig, StateSample, stateTimeline } from './unit-state';

const H = 3_600_000;
const T0 = Date.UTC(2026, 9, 14, 6);
const t = (ms: number) => new Date(T0 + ms);
const WINDOW = { start: t(0), end: t(8 * H) };

const CONFIG: StateConfig = {
  rules: [
    { match: 'RUN', state: 'running' },
    { match: '1', state: 'running' },
    { match: 'STOP', state: 'internal_stop' },
    { match: 'Starved', state: 'starved' },
  ],
  expectedIntervalSeconds: 10,
  jitterSeconds: 0,
  staleAfterIntervals: 3,
  heartbeat: true,
  acceptUncertain: false,
};

const sample = (
  ms: number,
  value: string | null,
  quality: StateSample['quality'] = 'good',
): StateSample => ({
  at: t(ms),
  value,
  quality,
});

/** a 10 s heartbeat from `from` to `to` with one value */
const beats = (from: number, to: number, value: string) =>
  Array.from({ length: Math.round((to - from) / 10_000) }, (_, i) =>
    sample(from + i * 10_000, value),
  );

describe('unit state timeline (SME D1 / D2)', () => {
  it('a 10 s heartbeat goes stale 30 s after the last sample; the gap is unknown, never filled', () => {
    const segments = stateTimeline(
      [sample(0, 'RUN'), sample(10_000, 'RUN')],
      CONFIG,
      { start: t(0), end: t(H) },
    );
    expect(
      segments.map((s) => [
        s.state,
        s.unknownReason,
        (s.end.getTime() - s.start.getTime()) / 1000,
      ]),
    ).toEqual([
      ['running', null, 40],
      ['unknown', 'stale', 3560],
    ]);
  });

  it('bad quality is unknown at once; unmapped values and time before the first sample are unknown', () => {
    const segments = stateTimeline(
      [
        sample(60_000, 'RUN'),
        sample(70_000, 'RUN', 'bad'),
        sample(80_000, 'MAINT?'),
        sample(90_000, 'STOP'),
      ],
      { ...CONFIG, heartbeat: false },
      { start: t(0), end: t(120_000) },
    );
    expect(segments.map((s) => [s.state, s.unknownReason])).toEqual([
      ['unknown', 'no_data'],
      ['running', null],
      ['unknown', 'bad_quality'],
      ['unknown', 'unmapped'],
      ['internal_stop', null],
    ]);
  });

  it('the last sample before the window decides its start; values match without case', () => {
    const segments = stateTimeline([sample(-5_000, 'starved')], CONFIG, {
      start: t(0),
      end: t(60_000),
    });
    expect(segments[0]).toMatchObject({
      state: 'starved',
      start: t(0),
      end: t(25_000),
    });
  });
});

describe('coverage and availability bounds (SME D2 worked example)', () => {
  it('8 h scheduled: 6 h running, 1 h stopped, 1 h unknown → 75 %–87.5 %, coverage 87.5 %', () => {
    const samples = [...beats(0, 6 * H, 'RUN'), ...beats(6 * H, 7 * H, 'STOP')];
    const segments = stateTimeline(samples, CONFIG, WINDOW);
    const result = stateCoverage(segments, [WINDOW]);
    expect(result.scheduledSeconds).toBe(8 * 3600);
    // the last stop sample holds 30 s into the gap before it goes stale
    expect(result.runningSeconds).toBe(6 * 3600);
    expect(result.knownStoppedSeconds).toBe(3600 + 20);
    expect(result.availabilityLower).toBeCloseTo(0.75, 3);
    expect(result.availabilityUpper).toBeCloseTo(0.875, 2);
    expect(result.coverage).toBeCloseTo(0.875, 2);
    expect(result.knownTimeAvailability).toBeCloseTo(6 / 7, 2);
  });

  it('only scheduled time counts; no schedule gives no ratios', () => {
    const scheduled = scheduledIntervals(
      WINDOW,
      [{ start: t(2 * H), end: t(4 * H) }],
      false,
    );
    expect(
      scheduled.map((s) => (s.end.getTime() - s.start.getTime()) / H),
    ).toEqual([2, 4]);
    expect(scheduledIntervals(WINDOW, [], true)).toEqual([]);
    expect(stateCoverage([], []).coverage).toBeNull();
    expect(stateCoverage([], scheduled)).toMatchObject({
      unknownSeconds: 6 * 3600,
      availabilityLower: 0,
      availabilityUpper: 1,
    });
  });
});
