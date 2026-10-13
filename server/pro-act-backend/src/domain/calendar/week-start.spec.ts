import { defaultWeekStart, weekKey } from './week-start';

describe('plant week start (DT-10, owner 13 Oct 2026: Iran weeks start on Saturday)', () => {
  it('Iranian plants (Asia/Tehran or the Persian calendar) start the week on Saturday; others on Monday (ISO)', () => {
    expect(defaultWeekStart('Asia/Tehran', 'gregorian')).toBe('saturday');
    expect(defaultWeekStart(null, 'persian')).toBe('saturday');
    expect(defaultWeekStart('Europe/Berlin', 'gregorian')).toBe('monday');
    expect(defaultWeekStart(null, 'gregorian')).toBe('monday');
  });

  it('a Monday week keeps the ISO 8601 key', () => {
    expect(weekKey('2027-03-01', 'monday')).toBe('2027-W09');
    expect(weekKey('2027-01-03', 'monday')).toBe('2026-W53');
  });

  it('a Saturday week is keyed by its Saturday: Saturday to Friday share one key', () => {
    // 10 Oct 2026 is a Saturday, 16 Oct a Friday (the Iranian weekend is Thursday–Friday)
    expect(weekKey('2026-10-10', 'saturday')).toBe('2026-10-10');
    expect(weekKey('2026-10-15', 'saturday')).toBe('2026-10-10');
    expect(weekKey('2026-10-16', 'saturday')).toBe('2026-10-10');
    expect(weekKey('2026-10-17', 'saturday')).toBe('2026-10-17');
    expect(weekKey('2027-01-01', 'saturday')).toBe('2026-12-26');
  });
});
