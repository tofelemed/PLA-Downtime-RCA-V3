import { UnprocessableEntityException } from '@nestjs/common';
import { reviewMonthDates } from './bad-actor-month';

describe('bad-actor review month (month-key rule)', () => {
  it('reads a key of the plant calendar', () => {
    expect(reviewMonthDates('2026-10', 'gregorian')).toEqual({
      first: '2026-10-01',
      next: '2026-11-01',
    });
    expect(reviewMonthDates('1405-07', 'persian')).toEqual({
      first: '2026-09-23',
      next: '2026-10-23',
    });
  });

  it('refuses a Solar Hijri key on a Gregorian plant instead of reading it as the year 1405', () => {
    expect(() => reviewMonthDates('1405-07', 'gregorian')).toThrow(
      UnprocessableEntityException,
    );
    try {
      reviewMonthDates('1405-07', 'gregorian');
    } catch (error) {
      const body = (error as UnprocessableEntityException).getResponse();
      expect(body).toMatchObject({ code: 'MONTH_KEY_AMBIGUOUS' });
      expect(JSON.stringify(body)).toContain('2026-09');
    }
  });

  it('refuses a Gregorian key on a Persian plant', () => {
    expect(() => reviewMonthDates('2026-10', 'persian')).toThrow(
      UnprocessableEntityException,
    );
  });
});
