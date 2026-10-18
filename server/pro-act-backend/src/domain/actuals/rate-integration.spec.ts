import * as fc from 'fast-check';
import { EngineSample, EngineSignal } from './actuals.types';
import { integrateRate } from './rate-integration';

const T0 = Date.UTC(2026, 9, 7, 8, 0, 0);
const at = (minutes: number) => new Date(T0 + minutes * 60_000);
const window = (fromMin: number, toMin: number) => ({
  from: at(fromMin),
  to: at(toMin),
});
const samples = (
  pairs: Array<[number, string, EngineSample['quality']?]>,
): EngineSample[] =>
  pairs.map(([minute, value, quality]) => ({
    at: at(minute),
    value,
    quality: quality ?? 'good',
  }));
const rate = (overrides: Partial<EngineSignal> = {}): EngineSignal => ({
  semanticType: 'rate',
  interpolation: 'step',
  maxGapSeconds: 3600,
  rateTimebase: 'h',
  canonicalUom: 't',
  ...overrides,
});

describe('integrateRate (plan 1.7, ACT04)', () => {
  it('integrates t/h as tonnes and refuses a denominator inconsistent with the selected timebase', () => {
    const points = samples([
      [0, '28'],
      [60, '28'],
    ]);
    const result = integrateRate(
      points,
      rate({ canonicalUom: 't/h' }),
      window(0, 60),
    );
    expect(result.quantity).toBe('28');
    expect(result.method.uom).toBe('t');
    const wrong = integrateRate(
      points,
      rate({ canonicalUom: 't/min' }),
      window(0, 60),
    );
    expect(wrong.quantity).toBeNull();
    expect(wrong.exceptions[0].code).toBe('rate_uom_timebase_mismatch');
    const kg = integrateRate(
      points,
      rate({ canonicalUom: 'kg/h' }),
      window(0, 60),
    );
    expect(kg.method.uom).toBe('kg');
    expect(kg.quantity).toBe('28');
  });

  it.each(['step', 'linear'] as const)(
    'T25: 120 t/h for 30 min is 60 t (%s), method and timebase recorded',
    (interpolation) => {
      const result = integrateRate(
        samples([
          [0, '120'],
          [10, '120'],
          [20, '120'],
          [30, '120'],
        ]),
        rate({ interpolation }),
        window(0, 30),
      );

      expect(result.quantity).toBe('60');
      expect(result.method).toEqual({
        name: `rate_integration/${interpolation}`,
        interpolation,
        timebase: 'h',
        timebaseSeconds: 3600,
        uom: 't',
      });
      expect(result.coverage.ratio).toBe('1');
      expect(result.qualityState).toBe('complete');
    },
  );

  it('step holds a value from before the window; linear integrates the ramp', () => {
    const ramp = samples([
      [-10, '0'],
      [50, '60'],
    ]);

    expect(integrateRate(ramp, rate(), window(0, 30)).quantity).toBe('0');
    // linear: value 10 → 40 over 30 min = average 25 t/h × 0.5 h
    expect(
      integrateRate(
        ramp,
        rate({ interpolation: 'linear', maxGapSeconds: 7200 }),
        window(0, 30),
      ).quantity,
    ).toBe('12.5');
  });

  it('bad intervals are excluded and reported; the rest still counts', () => {
    const result = integrateRate(
      samples([
        [0, '60'],
        [10, '0', 'bad'],
        [20, '60'],
      ]),
      rate(),
      window(0, 30),
    );

    expect(result.quantity).toBe('20');
    expect(result.coverage).toMatchObject({
      observedSeconds: 1200,
      excludedSeconds: 600,
    });
    expect(result.exceptions).toEqual([
      {
        code: 'bad_quality',
        from: at(10).toISOString(),
        to: at(20).toISOString(),
      },
    ]);
  });

  it('negative and above-range values are out_of_range; gaps are missing', () => {
    const result = integrateRate(
      samples([
        [0, '-1'],
        [5, '600'],
        [10, '60'],
        [40, '60'],
      ]),
      rate({ expectedMax: '500', maxGapSeconds: 600 }),
      window(0, 40),
    );

    expect(result.quantity).toBeNull();
    expect(result.exceptions.map((e) => e.code)).toEqual([
      'out_of_range',
      'out_of_range',
      'gap',
      'no_data',
    ]);
    expect(result.coverage.missingSeconds).toBe(1800);
  });

  it('a rate without a timebase is refused (no assumed conversion)', () => {
    const result = integrateRate(
      samples([[0, '10']]),
      rate({ rateTimebase: null }),
      window(0, 10),
    );

    expect(result.quantity).toBeNull();
    expect(result.exceptions[0].code).toBe('missing_timebase');
  });

  it('property: a zero rate integrates to 0 whatever the sample times', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: -30, max: 90 }), {
          minLength: 1,
          maxLength: 30,
        }),
        fc.constantFrom('step', 'linear'),
        (minutes, interpolation) => {
          const result = integrateRate(
            samples(minutes.map((minute) => [minute, '0'])),
            rate({ interpolation: interpolation as 'step' | 'linear' }),
            window(0, 60),
          );
          return result.quantity === null || result.quantity === '0';
        },
      ),
    );
  });
});
