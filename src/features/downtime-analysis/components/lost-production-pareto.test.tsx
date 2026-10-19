import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { LossTreeGroupView, LossTreeView } from '@/api/v2/types/pla-analytics';
import { DisplayCurrencyContext } from '@/features/display-currency/display-currency-context';
import { LostProductionBody } from './lost-production-pareto';

const group = (key: string, unit: string, amount: string | null, cumulativeShare: string | null): LossTreeGroupView => ({
  key, label: `${key.toUpperCase()} name`, unit, amount, share: null, cumulativeShare, lines: 1, status: amount === null ? 'unvalued' : 'valued', fxProvisional: false, reasons: [],
});

const view = (groups: LossTreeGroupView[], units: string[]): LossTreeView => ({
  groupBy: 'reason', metric: 'margin', view: 'contribution_margin', defaultView: false, valuationStatus: 'approved', approvedPeriods: 1, periods: 1, ledger: 'plan', basis: 'b', groups, truncated: 0, calculationRunIds: [],
  totals: units.map((unit) => ({ unit, amount: null, lines: 1, groups: 1, status: 'valued', fxProvisional: false, reasons: [] })),
});

describe('LostProductionBody (FE-08)', () => {
  it('QA N2: the value view shows the display currency only (USD by default), one table', () => {
    render(<LostProductionBody data={view([group('r1', 'IRR', '900', '0.9'), group('r2', 'IRR', '100', '1'), group('r1', 'USD', '30', '1')], ['IRR', 'USD'])} />);
    expect(screen.queryByTestId('lost-production-table-IRR')).toBeNull();
    const usd = screen.getByTestId('lost-production-table-USD');
    expect(within(usd).getAllByTestId('loss-group').map((cell) => cell.dataset.amount)).toEqual(['30']);
    expect(screen.queryByText('USD', { selector: 'p' })).toBeNull();
  });

  it('QA N2: follows the header toggle (IRR); without amounts in that currency every table is shown', () => {
    const data = view([group('r1', 'IRR', '900', '0.9'), group('r2', 'IRR', '100', '1'), group('r1', 'USD', '30', '1')], ['IRR', 'USD']);
    const { unmount } = render(
      <DisplayCurrencyContext.Provider value={{ currency: 'IRR', setCurrency: () => undefined }}>
        <LostProductionBody data={data} />
      </DisplayCurrencyContext.Provider>,
    );
    const irr = screen.getByTestId('lost-production-table-IRR');
    expect(within(irr).getAllByTestId('loss-group').map((cell) => cell.dataset.key)).toEqual(['r1', 'r2']);
    expect(screen.queryByTestId('lost-production-table-USD')).toBeNull();
    unmount();
    render(<LostProductionBody data={view([group('r1', 'IRR', '900', '1')], ['IRR'])} />);
    expect(screen.getByTestId('lost-production-table-IRR')).toBeInTheDocument();
  });

  it('a single unit shows no unit heading; an unvalued group keeps an empty amount, not 0', () => {
    render(<LostProductionBody data={view([group('r1', 'IRR', null, null)], ['IRR'])} />);
    expect(screen.queryByText('IRR', { selector: 'p' })).toBeNull();
    expect(screen.getByTestId('loss-group').dataset.amount).toBe('');
  });
});
