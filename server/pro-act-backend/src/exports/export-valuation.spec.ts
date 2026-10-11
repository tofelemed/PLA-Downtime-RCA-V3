import { presentMoney } from './export-valuation';

describe('presentMoney (VAL03: currency minor units, half-even)', () => {
  it('IRR has no minor unit: rounded half-even to whole rials', () => {
    expect(presentMoney('15000.125', 'IRR')).toBe('15000');
    expect(presentMoney('2.5', 'IRR')).toBe('2');
    expect(presentMoney('3.5', 'IRR')).toBe('4');
    expect(presentMoney('150000000.00000000', 'IRR')).toBe('150000000');
    expect(presentMoney('0', 'IRR')).toBe('0');
    expect(presentMoney('-7.5', 'IRR')).toBe('-8');
  });

  it('USD keeps 2 decimals, rounded half-even', () => {
    expect(presentMoney('1234.5', 'USD')).toBe('1234.50');
    expect(presentMoney('0.125', 'USD')).toBe('0.12');
    expect(presentMoney('0.135', 'USD')).toBe('0.14');
    expect(presentMoney('300', 'USD')).toBe('300.00');
  });

  it('an unknown currency falls back to 2 decimals; null stays empty', () => {
    expect(presentMoney('1.005', 'EUR')).toBe('1.00');
    expect(presentMoney('1.005', null)).toBe('1.00');
    expect(presentMoney(null, 'IRR')).toBeNull();
  });
});
