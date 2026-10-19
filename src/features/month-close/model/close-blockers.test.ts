import { describe, expect, it } from 'vitest';
import { cappedMonthCloseFixture, monthCloseFixture } from '../month-close-test-fixtures';
import { closeBlockedReason, closeBlockersOf, closeHeadline } from './close-blockers';

describe('month close blockers (QA re-test N1, Aban future month)', () => {
  it('a settled, ended month has no blocker', () => {
    const view = monthCloseFixture();
    expect(closeBlockersOf(view)).toEqual([]);
    expect(closeHeadline(view)).toBe('Prerequisites met.');
    expect(closeBlockedReason(view)).toBeNull();
  });

  it('every count settled but the month not ended: waiting, not "need attention"', () => {
    const view = monthCloseFixture();
    view.prerequisites = { ...view.prerequisites, met: false, monthEnded: false };
    expect(closeBlockersOf(view)).toEqual(['not-ended']);
    expect(closeHeadline(view)).toBe('Prerequisites met — waiting for the month to end.');
    expect(closeBlockedReason(view)).toBe('Month not ended yet.');
  });

  it('a month that has not started says so', () => {
    const view = monthCloseFixture();
    view.prerequisites = { ...view.prerequisites, met: false, monthEnded: false, monthStarted: false, periods: 0, approved: 0, days: 0, certifiedDays: 0 };
    expect(closeHeadline(view)).toBe('This month has not started yet.');
    expect(closeBlockedReason(view)).toBe('This month has not started yet.');
  });

  it('real blockers still need attention', () => {
    const view = cappedMonthCloseFixture();
    expect(closeBlockersOf(view)).toEqual(['pending-periods', 'uncertified-days', 'open-proposals']);
    expect(closeHeadline(view)).toBe('Prerequisites need attention.');
    expect(closeBlockedReason(view)).toBe('Resolve the blocking prerequisites shown above before closing the quantities.');
  });

  it('policy-exempt counts are not blockers', () => {
    const view = cappedMonthCloseFixture();
    view.policy = { ...view.policy, requireCertifiedDays: false, blockOnOpenProposals: false };
    view.prerequisites = { ...view.prerequisites, pendingCount: 0 };
    expect(closeBlockersOf(view)).toEqual([]);
  });
});
