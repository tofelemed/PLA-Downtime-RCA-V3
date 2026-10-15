import { plantMonthDates } from './plant-month';

describe('plantMonthDates (the plant calendar decides what a month is)', () => {
  it('Gregorian months, December rolls into January', () => {
    expect(plantMonthDates('2027-03', 'gregorian')).toEqual({
      first: '2027-03-01',
      next: '2027-04-01',
    });
    expect(plantMonthDates('2026-12', 'gregorian')).toEqual({
      first: '2026-12-01',
      next: '2027-01-01',
    });
  });

  it('Persian months: Farvardin 1403 starts 2024-03-20; Mehr 1405 is 2026-09-23 to 2026-10-23', () => {
    expect(plantMonthDates('1403-01', 'persian')?.first).toBe('2024-03-20');
    expect(plantMonthDates('1405-07', 'persian')).toEqual({
      first: '2026-09-23',
      next: '2026-10-23',
    });
  });

  it('Esfand runs to Farvardin 1 of the next year (29 days, 30 in a leap year)', () => {
    expect(plantMonthDates('1402-12', 'persian')).toEqual({
      first: '2024-02-20',
      next: '2024-03-20',
    });
    expect(plantMonthDates('1403-12', 'persian')).toEqual({
      first: '2025-02-19',
      next: '2025-03-21',
    });
  });

  it('a malformed month is null', () => {
    expect(plantMonthDates('2027-13', 'gregorian')).toBeNull();
    expect(plantMonthDates('1405-7', 'persian')).toBeNull();
  });
});
