import { describe, expect, it } from 'vitest';
import { plantDaysOf, rangeOfPlantDays, windowRangeText } from './window-range';

const GREGORIAN = { calendar: 'gregorian', digits: 'latin' } as const;

describe('window text on the plant calendar (UX audit D-13)', () => {
  const range = { from: '2026-10-10T20:30:00.000Z', to: '2026-10-17T20:30:00.000Z' };

  it('shows inclusive plant days in ISO form, never the browser locale', () => {
    expect(windowRangeText(range, 'Last 7 days', 'Asia/Tehran', GREGORIAN)).toBe('Last 7 days · 2026-10-11 – 2026-10-17');
  });

  it('follows the Persian calendar preference', () => {
    expect(windowRangeText(range, 'Chosen dates', 'Asia/Tehran', { calendar: 'persian', digits: 'latin' })).toBe('Chosen dates · 1405/07/19 – 1405/07/25');
  });
});

describe('production-day windows (QA PLA M1)', () => {
  const day = { from: '2026-10-17T02:30:00.000Z', to: '2026-10-18T02:30:00.000Z' };

  it('labels one 06:00–06:00 production day as one day', () => {
    expect(windowRangeText(day, 'Chosen dates', 'Asia/Tehran', GREGORIAN)).toBe('Chosen dates · 2026-10-17 (production day 06:00–06:00)');
    expect(plantDaysOf(day, 'Asia/Tehran')).toEqual({ start: '2026-10-17', end: '2026-10-17', boundary: '06:00' });
  });

  it('names a run of production days by their start dates', () => {
    const two = { from: day.from, to: '2026-10-19T02:30:00.000Z' };
    expect(windowRangeText(two, 'Chosen dates', 'Asia/Tehran', GREGORIAN)).toBe('Chosen dates · 2026-10-17 – 2026-10-18 (production days 06:00–06:00)');
  });

  it('a shift window (06:00–14:00) is not a production day', () => {
    const shift = { from: day.from, to: '2026-10-17T10:30:00.000Z' };
    expect(plantDaysOf(shift, 'Asia/Tehran').boundary).toBe('00:00');
  });

  it('choosing 17 → 17 keeps the production-day window, not midnight to midnight', () => {
    expect(rangeOfPlantDays({ start: '2026-10-17', end: '2026-10-17' }, '06:00', 'Asia/Tehran')).toEqual(day);
  });
});
