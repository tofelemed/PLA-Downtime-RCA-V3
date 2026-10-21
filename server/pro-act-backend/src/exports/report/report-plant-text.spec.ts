import { plantDayText, plantMonthText, printCell } from './report-values';

const persian = {
  timezone: 'Asia/Tehran',
  calendar: 'persian',
  digits: 'persian',
} as const;
const gregorian = {
  timezone: 'UTC',
  calendar: 'gregorian',
  digits: 'latin',
} as const;

describe('report export titles on the plant calendar (settings audit, 21 Oct 2026)', () => {
  it('names a Persian plant month in its own calendar and digits', () => {
    expect(plantMonthText('1405-07', persian)).toBe('Mehr ۱۴۰۵');
    expect(printCell('1405-07', { type: 'month' }, persian)).toBe('Mehr ۱۴۰۵');
    expect(plantMonthText('2026-10', gregorian)).toBe('Oct 2026');
  });

  it('writes a plant day on the plant calendar, never the raw ISO date', () => {
    expect(plantDayText('2026-10-12', gregorian)).not.toBe('');
    expect(plantDayText('2026-10-12', persian)).toContain('۱۴۰۵');
    expect(plantDayText('2026-10-12', persian)).not.toContain('2026');
  });
});
