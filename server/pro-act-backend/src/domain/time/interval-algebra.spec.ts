import {
  boundAt,
  BoundedInterval,
  clip,
  durationSeconds,
  splitAt,
  union,
  unionSeconds,
} from './interval-algebra';

const at = (time: string) => new Date(`2026-10-07T${time}:00.000Z`);
const range = (start: string, end: string): BoundedInterval => ({
  start: at(start),
  end: at(end),
});

/** Deterministic PRNG (mulberry32) so the property checks are reproducible without extra dependencies. */
function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomIntervals(next: () => number, count: number): BoundedInterval[] {
  const base = at('00:00').getTime();
  return Array.from({ length: count }, () => {
    const start = base + Math.floor(next() * 86_400) * 1000;
    const length = Math.floor(next() * 7_200) * 1000;
    return { start: new Date(start), end: new Date(start + length) };
  });
}

const seconds = (intervals: BoundedInterval[]) =>
  intervals.reduce(
    (sum, i) => sum + (i.end.getTime() - i.start.getTime()) / 1000,
    0,
  );

describe('interval algebra (§3.3, DT05)', () => {
  it('T01: 06:00–07:30 is 5400 s', () => {
    expect(durationSeconds(range('06:00', '07:30'))).toBe(5400);
  });

  it('T02: a running interval has no duration, but elapsed time as of a moment', () => {
    const running = { start: at('10:00'), end: null };
    expect(durationSeconds(running)).toBeNull();
    expect(durationSeconds(running, at('10:15'))).toBe(900);
    expect(durationSeconds(running, at('09:00'))).toBe(0);
    expect(boundAt(running, at('10:15'))).toEqual(range('10:00', '10:15'));
  });

  it('T03: union of 10:00–11:00 and 10:30–11:30 is 5400 s, not 7200', () => {
    const intervals = [range('10:00', '11:00'), range('10:30', '11:30')];
    expect(unionSeconds(intervals)).toBe(5400);
    expect(union(intervals)).toEqual([range('10:00', '11:30')]);
  });

  it('T29: 05:50–06:20 split at 06:00 is 600 + 1200 s', () => {
    const parts = splitAt(range('05:50', '06:20'), [at('06:00'), at('12:00')]);
    expect(parts).toEqual([range('05:50', '06:00'), range('06:00', '06:20')]);
    expect(parts.map((part) => durationSeconds(part))).toEqual([600, 1200]);
  });

  it('clips to a half-open window; touching intervals do not overlap', () => {
    const window = range('06:00', '14:00');
    expect(clip(range('05:00', '07:00'), window)).toEqual(
      range('06:00', '07:00'),
    );
    expect(clip({ start: at('13:00'), end: null }, window)).toEqual(
      range('13:00', '14:00'),
    );
    expect(clip(range('14:00', '15:00'), window)).toBeNull();
    expect(clip(range('05:00', '06:00'), window)).toBeNull();
  });

  it('joins adjacent intervals and drops empty ones', () => {
    expect(
      union([
        range('08:00', '09:00'),
        range('09:00', '10:00'),
        range('11:00', '11:00'),
      ]),
    ).toEqual([range('08:00', '10:00')]);
  });

  describe('properties (200 seeded cases each)', () => {
    const cases = Array.from({ length: 200 }, (_, index) => index + 1);

    it.each(cases)('union is idempotent and commutative (seed %i)', (seed) => {
      const next = prng(seed);
      const intervals = randomIntervals(next, 1 + Math.floor(next() * 8));
      const merged = union(intervals);
      expect(union(merged)).toEqual(merged);
      expect(union([...intervals].reverse())).toEqual(merged);
      expect(unionSeconds(intervals)).toBeLessThanOrEqual(
        seconds(intervals) + 1e-9,
      );
      merged.slice(1).forEach((interval, i) => {
        expect(interval.start.getTime()).toBeGreaterThan(
          merged[i].end.getTime(),
        );
      });
    });

    it.each(cases)(
      'split parts are contiguous and sum to the whole (seed %i)',
      (seed) => {
        const next = prng(seed);
        const [interval] = randomIntervals(next, 1);
        const boundaries = randomIntervals(next, 5).map((i) => i.start);
        const parts = splitAt(interval, boundaries);
        expect(seconds(parts)).toBeCloseTo(seconds([interval]), 9);
        expect(parts[0].start).toEqual(interval.start);
        expect(parts[parts.length - 1].end).toEqual(interval.end);
      },
    );

    it.each(cases)('clip never grows an interval (seed %i)', (seed) => {
      const next = prng(seed);
      const [interval, window] = randomIntervals(next, 2);
      const clipped = clip(interval, window);
      if (clipped) {
        expect(seconds([clipped])).toBeLessThanOrEqual(
          Math.min(seconds([interval]), seconds([window])),
        );
      }
    });
  });
});
