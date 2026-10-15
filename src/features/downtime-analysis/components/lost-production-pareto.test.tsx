import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { LossTreeGroupView, LossTreeView } from '@/api/v2/types/pla-analytics';
import { LostProductionBody } from './lost-production-pareto';

const group = (key: string, unit: string, amount: string | null, cumulativeShare: string | null): LossTreeGroupView => ({
  key, label: `${key.toUpperCase()} name`, unit, amount, share: null, cumulativeShare, lines: 1, status: amount === null ? 'unvalued' : 'valued', fxProvisional: false, reasons: [],
});

const view = (groups: LossTreeGroupView[], units: string[]): LossTreeView => ({
  groupBy: 'reason', metric: 'margin', view: 'contribution_margin', defaultView: false, valuationStatus: 'approved', approvedPeriods: 1, periods: 1, ledger: 'plan', basis: 'b', groups, truncated: 0, calculationRunIds: [],
  totals: units.map((unit) => ({ unit, amount: null, lines: 1, groups: 1, status: 'valued', fxProvisional: false, reasons: [] })),
});

describe('LostProductionBody (FE-08)', () => {
  it('one table per currency; groups never mixed across currencies', () => {
    render(<LostProductionBody data={view([group('r1', 'IRR', '900', '0.9'), group('r2', 'IRR', '100', '1'), group('r1', 'USD', '30', '1')], ['IRR', 'USD'])} />);
    const irr = screen.getByTestId('lost-production-table-IRR');
    expect(within(irr).getAllByTestId('loss-group').map((cell) => cell.dataset.key)).toEqual(['r1', 'r2']);
    const usd = screen.getByTestId('lost-production-table-USD');
    expect(within(usd).getAllByTestId('loss-group').map((cell) => cell.dataset.amount)).toEqual(['30']);
  });

  it('a single unit shows no unit heading; an unvalued group keeps an empty amount, not 0', () => {
    render(<LostProductionBody data={view([group('r1', 'IRR', null, null)], ['IRR'])} />);
    expect(screen.queryByText('IRR', { selector: 'p' })).toBeNull();
    expect(screen.getByTestId('loss-group').dataset.amount).toBe('');
  });
});
