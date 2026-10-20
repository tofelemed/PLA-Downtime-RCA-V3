import { describe, expect, it } from 'vitest';
import { lastProductionDate, monthToDateWindow } from './month-to-date';

const TZ = 'Asia/Tehran';

describe('month to date (R1)', () => {
  it('ends on the production day holding the instant before the window end', () => {
    // 06:00 Tehran (+03:30) on 18 Oct = 02:30 UTC: the window covers the production day of 17 Oct
    expect(lastProductionDate('2026-10-18T02:30:00.000Z', '06:00', TZ)).toBe('2026-10-17');
    expect(lastProductionDate('2026-10-18T10:00:00.000Z', '06:00', TZ)).toBe('2026-10-18');
  });

  it('starts at the first production day of that calendar month', () => {
    expect(monthToDateWindow({ to: '2026-10-18T02:30:00.000Z' }, '06:00', TZ)).toEqual({
      from: '2026-10-01T02:30:00.000Z',
      to: '2026-10-18T02:30:00.000Z',
    });
  });

  it('a window ending on the 1st at day start is the whole previous month', () => {
    expect(monthToDateWindow({ to: '2026-11-01T02:30:00.000Z' }, '06:00', TZ)?.from).toBe('2026-10-01T02:30:00.000Z');
  });

  it('is null for an invalid end', () => {
    expect(monthToDateWindow({ to: 'not a date' }, '06:00', TZ)).toBeNull();
  });
});
