import { describe, expect, it } from 'vitest';
import { monthOfDate, monthTitle, monthWeeks, moveDay, shiftMonth, weekdayLabels, weekStartIndex } from './calendar-month-model';

const days = (week: ReadonlyArray<{ day: number } | null>) => week.map((cell) => cell?.day ?? null);

describe('calendar month model', () => {
  it('lays out a Gregorian month from the plant week start (default Saturday)', () => {
    // 1 Oct 2026 is a Thursday: Sat, Sun, Mon, Tue, Wed are blank
    const weeks = monthWeeks({ year: 2026, month: 10 }, 'gregorian', 'saturday');
    expect(days(weeks[0])).toEqual([null, null, null, null, null, 1, 2]);
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0][5]?.iso).toBe('2026-10-01');
    expect(weekStartIndex(undefined)).toBe(weekStartIndex('saturday'));
  });

  it('honours another week start', () => {
    const weeks = monthWeeks({ year: 2026, month: 10 }, 'gregorian', 'monday');
    expect(days(weeks[0])).toEqual([null, null, null, 1, 2, 3, 4]);
    expect(weekdayLabels('monday')[0]).toBe('Mon');
    expect(weekdayLabels('saturday')).toEqual(['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  });

  it('lays out a Solar Hijri month: 1 Mehr 1405 is Wednesday 23 Sep 2026, Mehr has 30 days', () => {
    const weeks = monthWeeks({ year: 1405, month: 7 }, 'persian', 'saturday');
    expect(days(weeks[0])).toEqual([null, null, null, null, 1, 2, 3]);
    expect(weeks[0][4]?.iso).toBe('2026-09-23');
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
  });

  it('finds the month of a date in either calendar and steps months across years', () => {
    expect(monthOfDate('2026-10-24', 'gregorian')).toEqual({ year: 2026, month: 10 });
    expect(monthOfDate('2026-10-24', 'persian')).toEqual({ year: 1405, month: 8 });
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 1405, month: 1 }, -1)).toEqual({ year: 1404, month: 12 });
  });

  it('titles the month in the plant calendar and digits', () => {
    expect(monthTitle({ year: 2026, month: 10 }, 'gregorian', 'latin')).toBe('October 2026');
    expect(monthTitle({ year: 1405, month: 7 }, 'persian', 'persian')).toBe('Mehr ۱۴۰۵');
  });

  it('moves days for the arrow keys', () => {
    expect(moveDay('2026-10-01', 'ArrowLeft')).toBe('2026-09-30');
    expect(moveDay('2026-10-01', 'ArrowRight')).toBe('2026-10-02');
    expect(moveDay('2026-10-01', 'ArrowDown')).toBe('2026-10-08');
    expect(moveDay('2026-10-01', 'ArrowUp')).toBe('2026-09-24');
    expect(moveDay('2026-10-01', 'Tab')).toBeNull();
  });
});
