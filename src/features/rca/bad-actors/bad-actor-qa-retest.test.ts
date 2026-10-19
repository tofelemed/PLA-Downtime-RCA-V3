import { describe, expect, it } from 'vitest';
import { badActorEventsHref, excludedPeriodsNote, reviewWindowDates } from './bad-actor-model';

describe('bad-actor review (QA re-test 19 Oct)', () => {
  it('names the window by its inclusive plant dates (the server end is the next local midnight)', () => {
    const window = { from: '2026-08-02T20:30:00.000Z', to: '2026-10-31T20:30:00.000Z' };
    expect(reviewWindowDates(window, { timeZone: 'Asia/Tehran' })).toBe('2026-08-03 – 2026-10-31');
    expect(reviewWindowDates(window, { timeZone: 'Asia/Tehran', calendar: 'persian' })).toMatch(/^1405\/05\/12 – 1405\/08\/09$/);
  });

  it('N7: periods no approved plan covers are named apart, not counted as "not approved yet"', () => {
    const base = { valuationStatus: 'provisional' as const, periods: 8, approvedPeriods: 3 };
    expect(excludedPeriodsNote({ ...base, uncoveredPeriods: 5 })).toBe('5 periods not included: No approved plan covers these periods');
    expect(excludedPeriodsNote({ ...base, uncoveredPeriods: 4 })).toBe(
      '1 of 8 periods not approved yet, so their loss is not included; 4 periods not included: No approved plan covers these periods',
    );
    expect(excludedPeriodsNote({ ...base, uncoveredPeriods: 0 })).toBe('5 of 8 periods not approved yet, so their loss is not included');
    expect(excludedPeriodsNote({ valuationStatus: 'approved', periods: 3, approvedPeriods: 3, uncoveredPeriods: 0 })).toBe('');
  });

  it('a row opens the asset’s unplanned stops of the review window in the Event Hub', () => {
    const href = badActorEventsHref({ assetId: 'a1' }, { from: '2026-08-02T20:30:00.000Z', to: '2026-10-31T20:30:00.000Z' });
    const url = new URL(href, 'http://x');
    expect(url.pathname).toBe('/events');
    expect(url.searchParams.get('assets')).toBe('a1');
    expect(url.searchParams.get('classes')).toBe('unplanned');
    expect(url.searchParams.get('to')).toBe('2026-10-31T20:30:00.000Z');
  });
});
