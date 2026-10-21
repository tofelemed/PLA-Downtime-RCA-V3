import { plantMonthDates } from '../../src/domain/calendar/plant-month';
import { IntegrationHarness } from './harness';

/** The Jalali month (`YYYY-MM`) of a Gregorian ISO date, from the TypeScript month boundaries. */
function jalaliMonthOf(day: string): string {
  const gregorianYear = Number(day.slice(0, 4));
  for (let jy = gregorianYear - 622; jy <= gregorianYear - 620; jy += 1) {
    for (let jm = 1; jm <= 12; jm += 1) {
      const key = `${jy}-${String(jm).padStart(2, '0')}`;
      const range = plantMonthDates(key, 'persian');
      if (range && range.first <= day && day < range.next) return key;
    }
  }
  throw new Error(`no Jalali month for ${day}`);
}

/**
 * The SQL plant month of a Persian plant (`jalali_month_key`, settings audit 21 Oct 2026) agrees day by day
 * with the TypeScript calendar the screens and the bad-actor report use, leap years included.
 */
describe('jalali_month_key (plant months of a Persian plant)', () => {
  const harness = new IntegrationHarness();

  beforeAll(() => harness.start());
  afterAll(() => harness.stop());

  it('matches the TypeScript calendar for every day of 2024–2030', async () => {
    const rows = await harness.dataSource.query<
      Array<{ day: string; key: string }>
    >(
      `SELECT to_char(d, 'YYYY-MM-DD') AS "day", jalali_month_key(d::date) AS "key"
         FROM generate_series('2024-01-01'::date, '2030-12-31'::date, interval '1 day') d`,
    );
    expect(rows.length).toBe(2557);
    const wrong = rows.filter((row) => row.key !== jalaliMonthOf(row.day));
    expect(wrong).toEqual([]);
    const byDay = new Map(rows.map((row) => [row.day, row.key]));
    // Nowruz 1405 is 21 Mar 2026; 1 Mehr 1405 is 23 Sep 2026
    expect(byDay.get('2026-03-20')).toBe('1404-12');
    expect(byDay.get('2026-03-21')).toBe('1405-01');
    expect(byDay.get('2026-09-23')).toBe('1405-07');
  });
});
