import { financialMonth } from './financial-month';
import { resolveMonthKey } from './month-key';

describe('resolveMonthKey (month close key in the plant close calendar)', () => {
  it('reads a bare key in the plant calendar', () => {
    expect(resolveMonthKey('1405-07', 'persian')).toEqual({
      ok: true,
      key: '1405-07',
    });
    expect(resolveMonthKey('2026-10', 'gregorian')).toEqual({
      ok: true,
      key: '2026-10',
    });
  });

  it('accepts a key qualified with the plant calendar', () => {
    expect(resolveMonthKey('persian:1405-07', 'persian')).toEqual({
      ok: true,
      key: '1405-07',
    });
    expect(resolveMonthKey('gregorian:2026-10', 'gregorian')).toEqual({
      ok: true,
      key: '2026-10',
    });
  });

  it('refuses 2026-10 on a Solar Hijri plant instead of reading Persian year 2026 (Gregorian 2647)', () => {
    expect(
      financialMonth('2026-10', 'persian').firstDate.startsWith('2647'),
    ).toBe(true);
    const result = resolveMonthKey('2026-10', 'persian');
    expect(result).toMatchObject({
      ok: false,
      code: 'MONTH_KEY_AMBIGUOUS',
      overlaps: ['1405-07', '1405-08'],
    });
    if (!result.ok) expect(result.message).toContain('persian:YYYY-MM');
  });

  it('refuses a month of the other calendar named explicitly', () => {
    expect(resolveMonthKey('gregorian:2026-10', 'persian')).toMatchObject({
      ok: false,
      code: 'MONTH_CALENDAR_MISMATCH',
      overlaps: ['1405-07', '1405-08'],
    });
    // Mehr 1405 = 23 Sep – 22 Oct 2026
    expect(resolveMonthKey('persian:1405-07', 'gregorian')).toMatchObject({
      ok: false,
      code: 'MONTH_CALENDAR_MISMATCH',
      overlaps: ['2026-09', '2026-10'],
    });
    expect(resolveMonthKey('1405-07', 'gregorian')).toMatchObject({
      ok: false,
      code: 'MONTH_KEY_AMBIGUOUS',
    });
  });

  it('refuses malformed keys, unknown calendars and a qualifier that contradicts the year', () => {
    for (const raw of [
      '1405-13',
      '1405-7',
      'hijri:1405-07',
      'persian:2026-10',
      'gregorian:1405-07',
      '',
    ]) {
      expect(resolveMonthKey(raw, 'persian')).toMatchObject({
        ok: false,
        code: 'INVALID_MONTH',
      });
    }
  });
});
