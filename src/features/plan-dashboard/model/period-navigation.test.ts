import { describe, expect, it } from 'vitest';
import { isPeriodSection, periodPath, periodSelection, withPeriodSelection } from './period-navigation';

describe('period section URL contract', () => {
  it('keeps the original bookmark and recognizes only the supported child sections', () => {
    expect(periodPath('plan', 'period')).toBe('/plans/plan/periods/period');
    for (const section of ['', 'actuals', 'review', 'value', 'history']) expect(isPeriodSection(section)).toBe(true);
    expect(isPeriodSection('adjustments/new')).toBe(false);
    expect(isPeriodSection('unknown')).toBe(false);
  });
  it('defaults missing or invalid selectors to the existing current / plan view', () => {
    expect(periodSelection(new URLSearchParams())).toEqual({ view: 'current', ledger: 'plan' });
    expect(periodSelection(new URLSearchParams('view=wrong&ledger=wrong'))).toEqual({ view: 'current', ledger: 'plan' });
    expect(periodSelection(new URLSearchParams('view=approved&ledger=capacity'))).toEqual({ view: 'approved', ledger: 'capacity' });
  });
  it('updates one selector without dropping unrelated or repeated query values', () => {
    const original = new URLSearchParams('view=approved&keep=one&keep=two');
    const next = withPeriodSelection(original, 'ledger', 'capacity');
    expect(next.toString()).toBe('view=approved&keep=one&keep=two&ledger=capacity');
    expect(original.has('ledger')).toBe(false);
  });
});
