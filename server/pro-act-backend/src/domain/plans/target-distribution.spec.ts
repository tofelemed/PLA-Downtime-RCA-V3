import * as fc from 'fast-check';
import { Dec } from '../actuals/decimal';
import { PlanGenerationError } from './plan.types';
import { distribute, parseTarget, sumOf } from './target-distribution';

const decs = (values: Array<string | number>) => values.map((v) => new Dec(v));
const strings = (values: Dec[]) => values.map((v) => v.toFixed());

describe('distribute (PLAN03 exact target distribution)', () => {
  it('splits 1000 over capacities [300, 300, 400] exactly', () => {
    expect(strings(distribute(new Dec(1000), decs([300, 300, 400])))).toEqual([
      '300',
      '300',
      '400',
    ]);
  });

  it('puts the rounding remainder on the last eligible leaf (repeating decimals)', () => {
    const shares = distribute(new Dec(1000), decs([1, 1, 1]));
    expect(strings(shares)).toEqual([
      '333.33333333',
      '333.33333333',
      '333.33333334',
    ]);
    expect(sumOf(strings(shares))).toBe('1000');
  });

  it('gives 0 to zero-weight (excluded) leaves and the remainder to the last positive one', () => {
    const shares = distribute(new Dec(100), decs([2, 1, 0]));
    expect(strings(shares)).toEqual(['66.66666666', '33.33333334', '0']);
  });

  it('refuses a positive target without eligible time (NO_ELIGIBLE_TIME)', () => {
    expect(() => distribute(new Dec(5), decs([0, 0]))).toThrow(
      expect.objectContaining({ code: 'NO_ELIGIBLE_TIME' }),
    );
    expect(() => distribute(new Dec(5), [])).toThrow(PlanGenerationError);
  });

  it('allows a zero target on no eligible time', () => {
    expect(strings(distribute(new Dec(0), decs([0, 0])))).toEqual(['0', '0']);
  });

  it('property: Σ shares = total exactly, every share ≥ 0, zero weights get 0', () => {
    const weight = fc.oneof(
      fc.constant(0),
      fc.integer({ min: 1, max: 1_000_000 }),
      fc.double({ min: 0.0001, max: 10_000, noNaN: true }),
    );
    const total = fc
      .tuple(
        fc.integer({ min: 0, max: 2_000_000_000 }),
        fc.integer({ min: 1, max: 99_999_999 }),
      )
      .map(([units, fraction]) =>
        new Dec(units).plus(new Dec(fraction).div(1e8)),
      );
    fc.assert(
      fc.property(
        total,
        fc.array(weight, { minLength: 1, maxLength: 60 }),
        (t, ws) => {
          const weights = ws.map((w) => new Dec(w));
          fc.pre(weights.some((w) => w.gt(0)));
          const shares = distribute(t, weights);
          const sum = shares.reduce((a, s) => a.plus(s), new Dec(0));
          expect(sum.equals(t)).toBe(true);
          shares.forEach((share, i) => {
            expect(share.isNegative()).toBe(false);
            expect(share.decimalPlaces()).toBeLessThanOrEqual(8);
            if (weights[i].isZero()) expect(share.isZero()).toBe(true);
          });
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe('parseTarget', () => {
  it('accepts decimals up to 8 places', () => {
    expect(parseTarget('12.12345678').toFixed()).toBe('12.12345678');
  });

  it.each(['-1', '1.123456789', 'x', ''])('refuses %p', (value) => {
    expect(() => parseTarget(value)).toThrow(
      expect.objectContaining({ code: 'INVALID_TARGET' }),
    );
  });
});
