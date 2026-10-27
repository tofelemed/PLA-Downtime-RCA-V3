import { describe, expect, it } from 'vitest';
import { PLA_PAGES } from '@/features/analysis-navigation/analysis-pages';
import { DECLARED_NOT_AVAILABLE, declaredPagesFor, isCapacityBasedPage } from './model/declared-access';

describe('PLA pages in declared mode', () => {
  it('hides OEE and Capacity gap from the menu and keeps the rest', () => {
    const keys = declaredPagesFor(PLA_PAGES, true).map((page) => page.key);
    expect(keys).not.toContain('oee');
    expect(keys).not.toContain('capacity');
    expect(keys).toEqual(expect.arrayContaining(['overview', 'losses', 'trends', 'reconciliation', 'valuation']));
  });

  it('offers every page in computed mode', () => {
    expect(declaredPagesFor(PLA_PAGES, false)).toHaveLength(PLA_PAGES.length);
  });

  it('names the capacity-based pages and the note', () => {
    expect(isCapacityBasedPage('oee')).toBe(true);
    expect(isCapacityBasedPage('losses')).toBe(false);
    expect(DECLARED_NOT_AVAILABLE).toBe('Not available: this plant accounts declared losses');
  });
});
