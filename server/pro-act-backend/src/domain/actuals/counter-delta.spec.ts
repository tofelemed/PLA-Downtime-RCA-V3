import * as fc from 'fast-check';
import { EngineSample, EngineSignal } from './actuals.types';
import { counterDelta } from './counter-delta';
import { Dec } from './decimal';

const T0 = Date.UTC(2026, 9, 7, 8, 0, 0);
const at = (minutes: number) => new Date(T0 + minutes * 60_000);
const window = (fromMin: number, toMin: number) => ({
  from: at(fromMin),
  to: at(toMin),
});
const readings = (pairs: Array<[number, string]>): EngineSample[] =>
  pairs.map(([minute, value]) => ({
    at: at(minute),
    value,
    quality: 'good',
  }));
const counter = (overrides: Partial<EngineSignal> = {}): EngineSignal => ({
  semanticType: 'counter',
  interpolation: 'step',
  maxGapSeconds: 3600,
  resetPolicy: 'none',
  canonicalUom: 't',
  ...overrides,
});

describe('counterDelta (plan 1.7, ACT02/ACT03)', () => {
  it('sums deltas of a monotonic counter; step boundaries hold the last reading', () => {
    const result = counterDelta(
      readings([
        [-5, '100'],
        [10, '110'],
        [20, '125.5'],
        [30, '130'],
      ]),
      counter(),
      window(0, 30),
    );

    expect(result.quantity).toBe('30');
    expect(result.method).toMatchObject({
      name: 'counter_delta/step',
      uom: 't',
    });
    expect(result.coverage).toMatchObject({ ratio: '1', missingSeconds: 0 });
    expect(result.qualityState).toBe('complete');
  });

  it('linear boundaries interpolate between neighbouring readings (estimated basis)', () => {
    const result = counterDelta(
      readings([
        [-10, '0'],
        [10, '20'],
        [20, '30'],
        [40, '50'],
      ]),
      counter({ interpolation: 'linear' }),
      window(0, 30),
    );

    expect(result.quantity).toBe('30');
    expect(result.coverage.estimatedSeconds).toBe(1200);
    expect(result.coverage.measuredSeconds).toBe(600);
  });

  it('T26: rollover 995 → 5 with modulus 1000 is 10 when the implied rate is credible', () => {
    const signal = counter({
      resetPolicy: 'detect_drop',
      rolloverModulus: '1000',
      rateTimebase: 'h',
      expectedMax: '500',
    });
    const result = counterDelta(
      readings([
        [0, '995'],
        [6, '5'],
      ]),
      signal,
      window(0, 6),
    );

    expect(result.quantity).toBe('10');
    expect(result.segments).toEqual([
      expect.objectContaining({ kind: 'rollover', quantity: '10' }),
    ]);
  });

  it('T26: an implied rate above expectedMax is rate_implausible and the quantity is null', () => {
    const result = counterDelta(
      readings([
        [0, '995'],
        [6, '5'],
      ]),
      counter({
        resetPolicy: 'detect_drop',
        rolloverModulus: '1000',
        rateTimebase: 'h',
        expectedMax: '50',
      }),
      window(0, 6),
    );

    expect(result.quantity).toBeNull();
    expect(result.exceptions[0]).toMatchObject({
      code: 'rate_implausible',
      detail: { impliedRate: '100', expectedMax: '50' },
    });
  });

  it('T27: a drop with no reset time and no modulus is reset_unresolved, never 990 or 1010', () => {
    const result = counterDelta(
      readings([
        [0, '1000'],
        [60, '10'],
      ]),
      counter({ resetPolicy: 'detect_drop', rolloverModulus: null }),
      window(0, 60),
    );

    expect(result.quantity).toBeNull();
    expect(result.qualityState).toBe('incomplete');
    expect(result.exceptions.map((e) => e.code)).toEqual(['reset_unresolved']);
  });

  it('known_instant: a reset between the pre and post readings adds nothing', () => {
    const result = counterDelta(
      readings([
        [0, '100'],
        [10, '150'],
        [11, '2'],
        [20, '40'],
      ]),
      counter({ resetPolicy: 'known_instant' }),
      window(0, 20),
      { resets: [new Date(at(10).getTime() + 30_000)] },
    );

    expect(result.quantity).toBe('88');
    expect(result.segments.map((s) => s.kind)).toEqual([
      'delta',
      'reset',
      'delta',
    ]);
  });

  it('known_instant without a known reset is unresolved', () => {
    const result = counterDelta(
      readings([
        [0, '100'],
        [10, '2'],
      ]),
      counter({ resetPolicy: 'known_instant' }),
      window(0, 10),
    );

    expect(result.quantity).toBeNull();
    expect(result.exceptions[0].code).toBe('reset_unresolved');
  });

  it('a step longer than maxGapSeconds is missing coverage and its delta is not counted', () => {
    const result = counterDelta(
      readings([
        [0, '0'],
        [5, '5'],
        [50, '60'],
        [60, '70'],
      ]),
      counter({ maxGapSeconds: 600 }),
      window(0, 60),
    );

    expect(result.quantity).toBe('15');
    expect(result.coverage).toMatchObject({
      observedSeconds: 900,
      missingSeconds: 2700,
    });
    expect(result.exceptions).toEqual([
      expect.objectContaining({
        code: 'gap',
        detail: { uncountedDelta: '55' },
      }),
    ]);
  });

  it('bad samples are skipped; no usable reading is no_data with a null quantity', () => {
    const result = counterDelta(
      [{ at: at(5), value: '10', quality: 'bad' }],
      counter(),
      window(0, 10),
    );

    expect(result.quantity).toBeNull();
    expect(result.exceptions).toEqual([{ code: 'no_data' }]);
    expect(result.coverage.missingSeconds).toBe(600);
  });

  it('refuses a non-counter signal and an empty window', () => {
    expect(
      counterDelta([], counter({ semanticType: 'rate' }), window(0, 10))
        .exceptions[0].code,
    ).toBe('wrong_semantic_type');
    expect(counterDelta([], counter(), window(10, 10)).exceptions[0].code).toBe(
      'invalid_window',
    );
  });

  describe('properties', () => {
    const monotonic = fc
      .array(fc.integer({ min: 0, max: 10_000 }), {
        minLength: 2,
        maxLength: 40,
      })
      .map((increments) => {
        let total = 0;
        return increments.map((increment, index) => {
          total += increment;
          return [index, String(total / 100)] as [number, string];
        });
      });

    it('a monotonic counter without resets: Σ segment deltas = last − first', () => {
      fc.assert(
        fc.property(monotonic, (pairs) => {
          const result = counterDelta(
            readings(pairs),
            counter(),
            window(0, pairs.length - 1),
          );
          const sum = result.segments.reduce(
            (total, segment) => total.plus(segment.quantity ?? 0),
            new Dec(0),
          );
          const expected = new Dec(pairs[pairs.length - 1][1]).minus(
            pairs[0][1],
          );
          return result.quantity === expected.toFixed() && sum.eq(expected);
        }),
      );
    });

    it('never returns a negative quantity, whatever the readings and the policy', () => {
      const values = fc.array(fc.integer({ min: 0, max: 999 }), {
        minLength: 2,
        maxLength: 30,
      });
      const policy = fc.constantFrom('none', 'known_instant', 'detect_drop');
      fc.assert(
        fc.property(values, policy, (list, resetPolicy) => {
          const result = counterDelta(
            readings(list.map((value, index) => [index, String(value)])),
            counter({
              resetPolicy: resetPolicy as EngineSignal['resetPolicy'],
              rolloverModulus: '1000',
            }),
            window(0, list.length - 1),
            { resets: [at(1)] },
          );
          return (
            result.quantity === null || !new Dec(result.quantity).isNegative()
          );
        }),
      );
    });
  });
});
