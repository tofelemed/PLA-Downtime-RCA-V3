import { describe, expect, it } from 'vitest';
import {
  gregorianToJalali,
  isJalaliLeapYear,
  isValidJalaliDate,
  isoDateToJalali,
  jalaliMonthLength,
  jalaliToGregorian,
  jalaliToIsoDate,
} from './jalali';

const DAY_MS = 86_400_000;
const icu = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

function icuParts(ms: number): [number, number, number] {
  const parts = icu.formatToParts(ms);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  return [get('year'), get('month'), get('day')];
}

describe('Jalali arithmetic', () => {
  it('agrees with Intl (ICU persian) for every day of 1300..1500', () => {
    const start = jalaliToGregorian(1300, 1, 1);
    const mismatches: string[] = [];
    let ms = Date.UTC(start.gy, start.gm - 1, start.gd);
    let days = 0;
    for (;; ms += DAY_MS, days += 1) {
      const [jy, jm, jd] = icuParts(ms);
      if (jy > 1500) break;
      const d = new Date(ms);
      const j = gregorianToJalali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      if (j.jy !== jy || j.jm !== jm || j.jd !== jd) mismatches.push(`${d.toISOString()} ${jy}/${jm}/${jd}`);
    }
    expect(icuParts(Date.UTC(start.gy, start.gm - 1, start.gd))).toEqual([1300, 1, 1]);
    expect(days).toBeGreaterThan(201 * 365);
    expect(mismatches.slice(0, 5)).toEqual([]);
  });

  it('round-trips jalali → gregorian → jalali for every valid day of 1300..1500', () => {
    let failures = 0;
    for (let jy = 1300; jy <= 1500; jy += 1) {
      for (let jm = 1; jm <= 12; jm += 1) {
        for (let jd = 1; jd <= jalaliMonthLength(jy, jm); jd += 1) {
          const g = jalaliToGregorian(jy, jm, jd);
          const back = gregorianToJalali(g.gy, g.gm, g.gd);
          if (back.jy !== jy || back.jm !== jm || back.jd !== jd) failures += 1;
        }
      }
    }
    expect(failures).toBe(0);
  });

  it('round-trips gregorian → jalali → gregorian for every day 1921-03-21..2122-03-20', () => {
    let failures = 0;
    for (let ms = Date.UTC(1921, 2, 21); ms <= Date.UTC(2122, 2, 20); ms += DAY_MS) {
      const d = new Date(ms);
      const j = gregorianToJalali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      const g = jalaliToGregorian(j.jy, j.jm, j.jd);
      if (Date.UTC(g.gy, g.gm - 1, g.gd) !== ms) failures += 1;
    }
    expect(failures).toBe(0);
  });

  it('matches the Nowruz and leap-year fixtures', () => {
    expect(jalaliToIsoDate(1403, 1, 1)).toBe('2024-03-20');
    expect(jalaliToIsoDate(1404, 1, 1)).toBe('2025-03-21');
    expect(jalaliToIsoDate(1405, 7, 20)).toBe('2026-10-12');
    expect(jalaliToIsoDate(1399, 12, 30)).toBe('2021-03-20');
    expect(jalaliToIsoDate(1403, 12, 30)).toBe('2025-03-20');
    expect(isoDateToJalali('2026-10-12')).toEqual({ jy: 1405, jm: 7, jd: 20 });
    expect(isoDateToJalali('2024-03-20')).toEqual({ jy: 1403, jm: 1, jd: 1 });
    expect([1399, 1403, 1408].every(isJalaliLeapYear)).toBe(true);
    expect(isJalaliLeapYear(1404)).toBe(false);
    expect(jalaliToIsoDate(1404, 12, 30)).toBeNull();
  });

  it('has 31 × 6, 30 × 5 and a 29/30-day Esfand', () => {
    expect([1, 2, 3, 4, 5, 6].map((m) => jalaliMonthLength(1404, m))).toEqual([31, 31, 31, 31, 31, 31]);
    expect([7, 8, 9, 10, 11].map((m) => jalaliMonthLength(1404, m))).toEqual([30, 30, 30, 30, 30]);
    expect(jalaliMonthLength(1404, 12)).toBe(29);
    expect(jalaliMonthLength(1403, 12)).toBe(30);
  });

  it('rejects invalid dates', () => {
    expect(isValidJalaliDate(1404, 0, 1)).toBe(false);
    expect(isValidJalaliDate(1404, 13, 1)).toBe(false);
    expect(isValidJalaliDate(1404, 1, 32)).toBe(false);
    expect(isValidJalaliDate(1404, 7, 31)).toBe(false);
    expect(isValidJalaliDate(1404, 1, 0)).toBe(false);
    expect(isValidJalaliDate(1404.5, 1, 1)).toBe(false);
    expect(jalaliToIsoDate(1404, 7, 31)).toBeNull();
    expect(isoDateToJalali('2025-02-29')).toBeNull();
    expect(isoDateToJalali('2025-2-1')).toBeNull();
  });
});
