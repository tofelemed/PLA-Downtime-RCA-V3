import { describe, expect, it } from 'vitest';
import { formatCurrencyAmount } from '@/features/display-currency/money-format';
import { plural } from './plural';
import { formatQuantity, withUnit } from './units';

describe('figure and unit (QA: "28.00t", "4,200.00USD")', () => {
  it('always a space between the figure and its unit or currency', () => {
    expect(formatQuantity('28', 't')).toBe('28.00 t');
    expect(formatCurrencyAmount('4200', 'USD')).toBe('4,200.00 USD');
    expect(formatCurrencyAmount('2520000000', 'IRR')).toBe('2,520,000,000 IRR');
    expect(withUnit('12.5', 't/h')).toBe('12.5 t/h');
  });

  it('no unit or no figure leaves the figure alone', () => {
    expect(withUnit('28.00', null)).toBe('28.00');
    expect(formatQuantity(null, 't')).toBe('—');
  });
});

describe('plural (QA: "1 stop(s)", "1 groups")', () => {
  it('one and many', () => {
    expect(plural(1, 'stop', 'stops')).toBe('1 stop');
    expect(plural(0, 'stop', 'stops')).toBe('0 stops');
    expect(plural(1200, 'group', 'groups')).toBe('1,200 groups');
  });

  it('the count in the plant digits when a formatter is given', () => {
    expect(plural(2, 'stop', 'stops', (n) => `#${n}`)).toBe('#2 stops');
  });
});
