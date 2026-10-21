import {
  isTimezoneLocked,
  PlantTimezoneUsage,
  timezoneLockReason,
} from './plant-timezone-lock';

const NONE: PlantTimezoneUsage = {
  productionEvents: 0,
  signalSamples: 0,
  calculatedPeriods: 0,
  publishedCalendars: 0,
  shiftInstances: 0,
};

describe('plant time zone lock (settings audit, 21 Oct 2026)', () => {
  it('stays editable with nothing derived from the zone', () => {
    expect(isTimezoneLocked(NONE)).toBe(false);
    expect(timezoneLockReason(NONE)).toBeNull();
  });

  it('locks once a shift calendar is published or shifts were generated, even without events', () => {
    const calendars = { ...NONE, publishedCalendars: 1 };
    expect(isTimezoneLocked(calendars)).toBe(true);
    expect(timezoneLockReason(calendars, true)).toContain(
      '1 published shift calendar',
    );
    const shifts = { ...NONE, shiftInstances: 42 };
    expect(isTimezoneLocked(shifts)).toBe(true);
    expect(timezoneLockReason(shifts, true)).toContain('42 generated shifts');
  });
});
