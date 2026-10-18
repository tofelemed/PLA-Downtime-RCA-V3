import { describe, expect, it } from 'vitest';
import { monthLabelOf, typedMonthMatches } from './month-label';

describe('month label (D-12: plant month in words, Jalali on a Persian plant)', () => {
  it('names the month in the calendar the server states, with the plant digits', () => {
    expect(monthLabelOf('1405-07', 'persian', 'latin')).toBe('Mehr 1405');
    expect(monthLabelOf('1405-07', 'persian', 'persian')).toBe('Mehr ۱۴۰۵');
    expect(monthLabelOf('2026-09', 'gregorian', 'latin')).toBe('September 2026');
    expect(monthLabelOf('bad', 'gregorian', 'latin')).toBe('bad');
  });

  it('a typed confirmation matches the label ignoring case, spacing and digit system', () => {
    expect(typedMonthMatches(' mehr  1405 ', 'Mehr 1405')).toBe(true);
    expect(typedMonthMatches('Mehr 1405', 'Mehr ۱۴۰۵')).toBe(true);
    expect(typedMonthMatches('1405-07', 'Mehr 1405')).toBe(false);
    expect(typedMonthMatches('', '')).toBe(false);
  });
});
