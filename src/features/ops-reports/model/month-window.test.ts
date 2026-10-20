import { describe, expect, it } from 'vitest';
import { monthWindow } from './month-window';

describe('month window (R3)', () => {
  it('runs from the first production day to the next month’s first, at the day start', () => {
    expect(monthWindow({ firstDate: '2026-09-23', endDate: '2026-10-23' }, '06:00', 'Asia/Tehran')).toEqual({
      from: '2026-09-23T02:30:00.000Z',
      to: '2026-10-23T02:30:00.000Z',
    });
  });
});
