import { isOpenEndTime, piEndTime, piEndTimeIso } from './pi-time';

/** Plan 1.6 (PI03, B6): the open-frame sentinel is never an end time. */
describe('PI end times', () => {
  it('maps the documented sentinel and anything after 9999-01-01 to open (null)', () => {
    expect(piEndTime('9999-12-31T23:59:59Z')).toBeNull();
    expect(piEndTime('9999-01-01T00:00:00Z')).toBeNull();
    expect(isOpenEndTime('9999-12-31T23:59:59.9999999Z')).toBe(true);
  });

  it('keeps real end times and treats missing or unparsable values as open', () => {
    expect(piEndTimeIso('2026-10-08T06:30:00Z')).toBe(
      '2026-10-08T06:30:00.000Z',
    );
    expect(piEndTime(null)).toBeNull();
    expect(piEndTime(undefined)).toBeNull();
    expect(piEndTime('not a time')).toBeNull();
    expect(isOpenEndTime('2026-10-08T06:30:00Z')).toBe(false);
  });
});
