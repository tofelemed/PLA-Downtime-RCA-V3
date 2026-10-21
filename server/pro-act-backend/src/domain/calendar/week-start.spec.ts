import { defaultWeekStart, isoDayOf, WEEK_STARTS, weekKey } from './week-start';

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

  it('any day can start the week (owner 21 Oct 2026): the key is the date of that day, the seven days share it', () => {
    // 12 Oct 2026 is a Monday; for each start, a week is the 7 days from its first day
    const firstDay: Record<string, string> = {
      tuesday: '2026-10-13',
      wednesday: '2026-10-14',
      thursday: '2026-10-15',
      friday: '2026-10-16',
      saturday: '2026-10-17',
      sunday: '2026-10-18',
    };
    for (const [start, first] of Object.entries(firstDay)) {
      const weekStart = start as (typeof WEEK_STARTS)[number];
      const day0 = new Date(`${first}T00:00:00Z`).getTime();
      for (let offset = 0; offset < 7; offset += 1) {
        const day = new Date(day0 + offset * 86_400_000)
          .toISOString()
          .slice(0, 10);
        expect(weekKey(day, weekStart)).toBe(first);
      }
      const before = new Date(day0 - 86_400_000).toISOString().slice(0, 10);
      expect(weekKey(before, weekStart)).not.toBe(first);
    }
  });

  it('lists the days in ISO order (Monday 1 … Sunday 7)', () => {
    expect(WEEK_STARTS).toHaveLength(7);
    expect(isoDayOf('monday')).toBe(1);
    expect(isoDayOf('saturday')).toBe(6);
    expect(isoDayOf('sunday')).toBe(7);
  });
});
