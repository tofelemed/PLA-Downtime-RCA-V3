import { describe, expect, it } from 'vitest';
import type { AnalyticsScope } from './analytics-scope';
import { PLA_PAGES } from '@/features/analysis-navigation/analysis-pages';
import { breakdownModesFor, lossMetricsFor, plaPagesFor, scopeForMoneyAccess } from './money-access';

describe('PLA without money (owner 19 Oct 2026: operators)', () => {
  it('offers only the lost quantity metric', () => {
    expect(lossMetricsFor(false)).toEqual(['qty']);
    expect(lossMetricsFor(true)).toContain('economic_impact');
  });

  it('a money metric from a shared link falls back to quantity', () => {
    const scope = { lossMetric: 'margin' } as AnalyticsScope;
    expect(scopeForMoneyAccess(scope, false).lossMetric).toBe('qty');
    expect(scopeForMoneyAccess(scope, true)).toBe(scope);
  });

  it('drops the cost / margin opportunities mode', () => {
    const modes = [{ value: 'tree' }, { value: 'opportunities' }];
    expect(breakdownModesFor(modes, false)).toEqual([{ value: 'tree' }]);
    expect(breakdownModesFor(modes, true)).toEqual(modes);
  });

  it('QA re-test N1: the page tabs leave out Loss valuation without money', () => {
    expect(plaPagesFor(PLA_PAGES, false).map((page) => page.key)).not.toContain('valuation');
    expect(plaPagesFor(PLA_PAGES, true).map((page) => page.key)).toContain('valuation');
  });
});
