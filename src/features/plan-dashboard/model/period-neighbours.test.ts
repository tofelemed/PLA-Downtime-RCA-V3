import { describe, expect, it } from 'vitest';
import { latestBefore, nextPeriodQuery, previousPeriodQuery } from './period-neighbours';

const PLAN = { from: '2026-10-01T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z' };
const PERIOD = { periodId: 'p2', unitId: 'u1', utcStart: '2026-10-08T06:00:00.000Z', utcEnd: '2026-10-08T14:00:00.000Z' };

describe('previous / next period queries (UX audit D-5)', () => {
  it('asks for the first period from the end of this one to the plan end', () => {
    expect(nextPeriodQuery(PERIOD, PLAN)).toEqual({ unitIds: ['u1'], from: PERIOD.utcEnd, to: PLAN.to, limit: 1 });
  });

  it('asks for the newest period from the plan start to the start of this one, however long the gap (D-5)', () => {
    expect(previousPeriodQuery(PERIOD, PLAN)).toEqual({ unitIds: ['u1'], from: PLAN.from, to: PERIOD.utcStart, limit: 1, sort: '-utcStart' });
  });

  it('asks nothing at the plan edges', () => {
    expect(nextPeriodQuery({ ...PERIOD, utcEnd: PLAN.to }, PLAN)).toBeNull();
    expect(previousPeriodQuery({ ...PERIOD, utcStart: PLAN.from }, PLAN)).toBeNull();
  });

  it('the previous period is the first (newest) listed row starting before this one', () => {
    const rows = [
      { periodId: 'p2', utcStart: PERIOD.utcStart },
      { periodId: 'p1', utcStart: '2026-10-07T22:00:00.000Z' },
      { periodId: 'p0', utcStart: '2026-10-07T14:00:00.000Z' },
    ];
    expect(latestBefore(rows, PERIOD)?.periodId).toBe('p1');
    expect(latestBefore([], PERIOD)).toBeNull();
  });
});
