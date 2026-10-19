import { describe, expect, it } from 'vitest';
import { plantDaysOf, productionDatesOf, rangeOfPlantDays, snapToProductionDays, windowDatesText, windowRangeText } from './window-range';

const GREGORIAN = { calendar: 'gregorian', digits: 'latin' } as const;
const TEHRAN = 'Asia/Tehran';
const DAY_START = '06:00';
const PLANT = { timeZone: TEHRAN, dayStart: DAY_START };

describe('window text on the plant calendar (UX audit D-13)', () => {
  const range = { from: '2026-10-10T20:30:00.000Z', to: '2026-10-17T20:30:00.000Z' };

  it('shows inclusive calendar days in ISO form, never the browser locale', () => {
    expect(windowRangeText(range, 'Last 7 days', PLANT, GREGORIAN)).toBe('Last 7 days · 2026-10-11 – 2026-10-17');
  });

  it('follows the Persian calendar preference', () => {
    expect(windowRangeText(range, 'Chosen dates', PLANT, { calendar: 'persian', digits: 'latin' })).toBe('Chosen dates · 1405/07/19 – 1405/07/25');
  });
});

describe('production-day windows (QA PLA M1)', () => {
  const day = { from: '2026-10-17T02:30:00.000Z', to: '2026-10-18T02:30:00.000Z' };

  it('labels one 06:00–06:00 production day as one day', () => {
    expect(windowRangeText(day, 'Chosen dates', PLANT, GREGORIAN)).toBe('Chosen dates · 2026-10-17 (production day 06:00–06:00)');
    expect(plantDaysOf(day, TEHRAN, DAY_START)).toEqual({ start: '2026-10-17', end: '2026-10-17', boundary: '06:00' });
  });

  it('names a run of production days by their start dates', () => {
    const two = { from: day.from, to: '2026-10-19T02:30:00.000Z' };
    expect(windowRangeText(two, 'Chosen dates', PLANT, GREGORIAN)).toBe('Chosen dates · 2026-10-17 – 2026-10-18 (production days 06:00–06:00)');
  });

  it('a shift window (06:00–14:00) is not a whole day', () => {
    const shift = { from: day.from, to: '2026-10-17T10:30:00.000Z' };
    expect(plantDaysOf(shift, TEHRAN, DAY_START).boundary).toBeNull();
  });

  it('shift C (22:00–06:00) reads as part of one production day, not 17 – 18 Oct (QA PLA re-test)', () => {
    const shiftC = { from: '2026-10-17T18:30:00.000Z', to: day.to };
    expect(windowRangeText(shiftC, 'Chosen dates', PLANT, GREGORIAN)).toBe('Chosen dates · Production day 2026-10-17 · 22:00–06:00');
    expect(productionDatesOf(shiftC, TEHRAN, DAY_START)).toEqual({ start: '2026-10-17', end: '2026-10-17' });
  });

  it('a rolling window says its real bounds with times, not "production days 15:04–15:04" (QA PLA N6)', () => {
    const rolling = { from: '2026-10-12T11:34:00.000Z', to: '2026-10-19T11:34:00.000Z' };
    expect(plantDaysOf(rolling, TEHRAN, DAY_START).boundary).toBeNull();
    expect(windowRangeText(rolling, 'Last 7 days', PLANT, GREGORIAN)).toBe('Last 7 days · 2026-10-12 15:04 – 2026-10-19 15:04');
  });

  it('choosing 17 → 17 keeps the production-day window, not midnight to midnight', () => {
    expect(rangeOfPlantDays({ start: '2026-10-17', end: '2026-10-17' }, DAY_START, TEHRAN)).toEqual(day);
  });

  it('the date fields of a rolling window show the production days it touches', () => {
    const rolling = { from: '2026-10-12T11:34:00.000Z', to: '2026-10-19T11:34:00.000Z' };
    expect(productionDatesOf(rolling, TEHRAN, DAY_START)).toEqual({ start: '2026-10-12', end: '2026-10-19' });
    // 02:00 on 18 Oct belongs to the production day of 17 Oct
    expect(productionDatesOf({ from: '2026-10-17T22:30:00.000Z', to: '2026-10-17T23:30:00.000Z' }, TEHRAN, DAY_START)).toEqual({ start: '2026-10-17', end: '2026-10-17' });
  });

  it('without a site, days are calendar days', () => {
    expect(windowDatesText({ from: '2026-10-16T20:30:00.000Z', to: '2026-10-17T20:30:00.000Z' }, TEHRAN, '00:00', GREGORIAN)).toBe('2026-10-17');
  });
});

describe('Reports: rolling windows as whole production days (QA Reports N1)', () => {
  it('"Last 7 days" at 19 Oct 15:04 is the 7 complete production days 12 – 18 Oct, 06:00–06:00', () => {
    expect(snapToProductionDays('2026-10-19T11:34:00.000Z', 7, TEHRAN, DAY_START)).toEqual({ from: '2026-10-12T02:30:00.000Z', to: '2026-10-19T02:30:00.000Z' });
  });

  it('an end already on a production-day start is kept (idempotent)', () => {
    expect(snapToProductionDays('2026-10-19T02:30:00.000Z', 7, TEHRAN, DAY_START)).toEqual({ from: '2026-10-12T02:30:00.000Z', to: '2026-10-19T02:30:00.000Z' });
  });

  it('before 06:00 the running production day is the previous date', () => {
    expect(snapToProductionDays('2026-10-19T01:00:00.000Z', 1, TEHRAN, DAY_START)).toEqual({ from: '2026-10-17T02:30:00.000Z', to: '2026-10-18T02:30:00.000Z' });
  });
});
