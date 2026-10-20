import { describe, expect, it } from 'vitest';
import { lastProductionDate, monthStartOf, monthToDateWindow, twelveMonthWindow } from './month-to-date';

const TZ = 'Asia/Tehran';
const GREGORIAN = { dayStart: '06:00', timeZone: TZ, calendar: 'gregorian' as const };

describe('month to date (R1)', () => {
  it('ends on the production day holding the instant before the window end', () => {
    // 06:00 Tehran (+03:30) on 18 Oct = 02:30 UTC: the window covers the production day of 17 Oct
    expect(lastProductionDate('2026-10-18T02:30:00.000Z', '06:00', TZ)).toBe('2026-10-17');
    expect(lastProductionDate('2026-10-18T10:00:00.000Z', '06:00', TZ)).toBe('2026-10-18');
  });

  it('starts at the first production day of that Gregorian month', () => {
    expect(monthToDateWindow({ to: '2026-10-18T02:30:00.000Z' }, GREGORIAN)).toEqual({
      from: '2026-10-01T02:30:00.000Z',
      to: '2026-10-18T02:30:00.000Z',
    });
  });

  it('a window ending on the 1st at day start is the whole previous month', () => {
    expect(monthToDateWindow({ to: '2026-11-01T02:30:00.000Z' }, GREGORIAN)?.from).toBe('2026-10-01T02:30:00.000Z');
  });

  it('follows a Persian financial calendar: 17 Oct 2026 is 25 Mehr 1405, the month began 23 Sep', () => {
    expect(monthStartOf('2026-10-17', 'persian')).toBe('2026-09-23');
    expect(monthToDateWindow({ to: '2026-10-18T02:30:00.000Z' }, { ...GREGORIAN, calendar: 'persian' })?.from).toBe('2026-09-23T02:30:00.000Z');
  });

  it('is null for an invalid end', () => {
    expect(monthToDateWindow({ to: 'not a date' }, GREGORIAN)).toBeNull();
  });
});

describe('twelve-month window (R12)', () => {
  it('starts at the first production day eleven months before the window’s last month', () => {
    expect(twelveMonthWindow({ to: '2026-10-18T02:30:00.000Z' }, '06:00', 'Asia/Tehran')?.from).toBe('2025-11-01T02:30:00.000Z');
    expect(twelveMonthWindow({ to: '2027-01-10T02:30:00.000Z' }, '06:00', 'Asia/Tehran')?.from).toBe('2026-02-01T02:30:00.000Z');
  });
});
