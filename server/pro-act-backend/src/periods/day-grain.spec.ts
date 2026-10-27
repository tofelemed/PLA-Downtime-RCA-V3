import { spansOperationalDay } from './day-grain';

describe('spansOperationalDay', () => {
  const at = (iso: string) => new Date(iso);

  it('a 24 h period is the daily grain; an 8 h shift is not', () => {
    expect(
      spansOperationalDay(
        at('2027-03-01T02:30:00Z'),
        at('2027-03-02T02:30:00Z'),
      ),
    ).toBe(true);
    expect(
      spansOperationalDay(
        at('2027-03-01T02:30:00Z'),
        at('2027-03-01T10:30:00Z'),
      ),
    ).toBe(false);
  });

  it('a 23 h operational day (daylight-saving change) is still the daily grain', () => {
    expect(
      spansOperationalDay(
        at('2027-03-01T00:00:00Z'),
        at('2027-03-01T23:00:00Z'),
      ),
    ).toBe(true);
  });
});
