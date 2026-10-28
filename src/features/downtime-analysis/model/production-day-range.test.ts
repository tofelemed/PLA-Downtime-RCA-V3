import { describe, expect, it } from 'vitest';
import { plantLocalToUtc } from '@/lib/dates';
import { toCalendarDayRange, toProductionDayRange } from './production-day-range';

const TZ = 'Asia/Tehran';
// 17 Oct 2026 06:00 Tehran = 02:30Z (UTC+03:30)
const DAY = { from: '2026-10-17T02:30:00.000Z', to: '2026-10-18T02:30:00.000Z' };

describe('production-day date fields (owner decision 2026-10-19, QA L20)', () => {
  it('one production day reads as one inclusive date', () => {
    // plant midnights of 17 Oct and 18 Oct: the input shows From 17 Oct, To 17 Oct
    expect(toCalendarDayRange(DAY, TZ, '06:00')).toEqual({ from: '2026-10-16T20:30:00.000Z', to: '2026-10-17T20:30:00.000Z' });
  });

  it('a window ending at an arbitrary time reads its last day inclusive', () => {
    // 27 Oct 19:50 – 28 Oct 19:50 plant time: From 27 Oct, To 28 Oct (inclusive)
    const from = plantLocalToUtc('2026-10-27T19:50', TZ);
    const to = plantLocalToUtc('2026-10-28T19:50', TZ);
    expect(toCalendarDayRange({ from, to }, TZ, '06:00')).toEqual({ from: plantLocalToUtc('2026-10-27T00:00', TZ), to: plantLocalToUtc('2026-10-29T00:00', TZ) });
  });

  it('a two-day aligned window ends on the second day', () => {
    const range = { from: '2026-10-17T02:30:00.000Z', to: '2026-10-19T02:30:00.000Z' };
    expect(toCalendarDayRange(range, TZ, '06:00')).toEqual({ from: '2026-10-16T20:30:00.000Z', to: '2026-10-18T20:30:00.000Z' });
  });

  it('picked days become 06:00–06:00 bounds, and the round trip keeps the window', () => {
    const picked = { from: '2026-10-16T20:30:00.000Z', to: '2026-10-17T20:30:00.000Z' };
    expect(toProductionDayRange(picked, TZ, '06:00')).toEqual(DAY);
    expect(toProductionDayRange(toCalendarDayRange(DAY, TZ, '06:00'), TZ, '06:00')).toEqual(DAY);
  });

  it('a midnight day start keeps calendar days; open sides stay open', () => {
    const midnight = { from: '2026-10-16T20:30:00.000Z', to: null };
    expect(toCalendarDayRange(midnight, TZ, '00:00')).toEqual(midnight);
    expect(toProductionDayRange(midnight, TZ, '00:00')).toEqual(midnight);
  });
});
