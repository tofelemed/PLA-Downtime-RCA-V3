import { monthStartedAt } from './month-close-v2.view';

describe('monthStartedAt (QA re-test: a future month says it has not started)', () => {
  const tz = 'Asia/Tehran';

  it('is false before the first plant-local date (Aban 1405 seen on 19 Oct 2026)', () => {
    expect(
      monthStartedAt(new Date('2026-10-19T11:30:00Z'), '2026-10-23', tz),
    ).toBe(false);
  });

  it('is true from the first plant-local date on, by plant time not UTC', () => {
    // 2026-10-22T21:00Z is 2026-10-23 00:30 in Tehran
    expect(
      monthStartedAt(new Date('2026-10-22T21:00:00Z'), '2026-10-23', tz),
    ).toBe(true);
    expect(
      monthStartedAt(new Date('2026-10-22T20:00:00Z'), '2026-10-23', tz),
    ).toBe(false);
  });
});
