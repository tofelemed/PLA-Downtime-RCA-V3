import { formatDec } from '../actuals/decimal';
import {
  idealProductionSeconds,
  quantityOver,
  RateMathError,
  ratePerSecond,
} from './rate-math';

describe('rate math (plan 2.2)', () => {
  it('converts 120 t/h to t/s exactly to 8 places', () => {
    expect(formatDec(ratePerSecond({ rate: '120', timebase: 'h' }))).toBe(
      '0.03333333',
    );
    expect(
      ratePerSecond({ rate: '120', timebase: 'h' }).mul(3600).toFixed(),
    ).toBe('120');
  });

  it.each([
    ['s', '2'],
    ['min', '0.03333333'],
    ['h', '0.00055556'],
    ['d', '0.00002315'],
  ] as const)('2 per %s → %s per second', (timebase, expected) => {
    expect(formatDec(ratePerSecond({ rate: '2', timebase }))).toBe(expected);
  });

  it('gives the ideal time of 756 units at 2/min as 378 min (T20 input)', () => {
    const seconds = idealProductionSeconds('756', {
      rate: '2',
      timebase: 'min',
    });
    expect(seconds.toFixed()).toBe('22680');
    expect(seconds.div(60).toFixed()).toBe('378');
  });

  it('gives the capacity of an interval: 30 min at 100 t/h = 50 t', () => {
    expect(formatDec(quantityOver({ rate: '100', timebase: 'h' }, 1800))).toBe(
      '50',
    );
  });

  it('refuses a zero rate for ideal time and a negative or non-decimal rate', () => {
    expect(() =>
      idealProductionSeconds('10', { rate: '0', timebase: 'h' }),
    ).toThrow(RateMathError);
    expect(() => ratePerSecond({ rate: '-1', timebase: 'h' })).toThrow(
      RateMathError,
    );
    expect(() => ratePerSecond({ rate: 'abc', timebase: 'h' })).toThrow(
      RateMathError,
    );
    expect(() =>
      idealProductionSeconds('x', { rate: '1', timebase: 'h' }),
    ).toThrow(RateMathError);
  });
});
