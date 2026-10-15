import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { EconomicComponentGroupView } from '@/api/v2/types/period-overview';
import { DisplayCurrencyContext } from '@/features/display-currency/display-currency-context';
import { breakdownMoney, breakdownRows, breakdownStatus, shownCurrency } from './breakdown-model';
import { EconomicBreakdownTable } from './economic-breakdown-table';

const value = (currency: string, amount: string | null, over: Record<string, unknown> = {}) => ({
  currency,
  amount,
  status: 'valued' as const,
  fxProvisional: false,
  reasons: [],
  lines: 1,
  ...over,
});

const GROUPS: EconomicComponentGroupView[] = [
  { key: 'rework_cost', currencies: [value('IRR', '360000000'), value('USD', '600')], quantities: [{ uom: 't', quantity: '10' }] },
  {
    key: 'displaced_contribution',
    currencies: [value('IRR', null, { status: 'mixed', reasons: ['fx_rate_missing'] }), value('USD', '3000', { fxProvisional: true, reasons: ['fx_rate_provisional'] })],
    quantities: [{ uom: 't', quantity: '10' }],
  },
  { key: 'unvalued', currencies: [value('USD', null, { status: 'unvalued', reasons: ['demand_status_missing'] })], quantities: [{ uom: 't', quantity: '4' }] },
];

describe('VA-04 economic breakdown (display only: the server sums)', () => {
  it('rows keep the server order with the entry of the display currency; null amounts say why', () => {
    const rows = breakdownRows(GROUPS, 'USD');
    expect(rows.map((r) => [r.key, r.label, r.value?.amount ?? null])).toEqual([
      ['rework_cost', 'Rework cost', '600'],
      ['displaced_contribution', 'Displaced output at a sold-out unit', '3000'],
      ['unvalued', 'Not valued', null],
    ]);
    expect(breakdownMoney(rows[0].value, 'USD')).toBe('600.00 USD');
    expect(breakdownMoney(breakdownRows(GROUPS, 'IRR')[1].value, 'IRR')).toBe('— IRR (FX rate missing)');
    expect(breakdownMoney(rows[2].value, 'USD')).toBe('— USD (not valued)');
    expect(breakdownMoney(null, 'IRR')).toBe('— IRR');
    expect(breakdownStatus(rows[1].value)).toBe('provisional FX rate');
    expect(breakdownStatus(breakdownRows(GROUPS, 'IRR')[1].value)).toBe('partly valued');
  });

  it('shows the display currency when reported, else the first reported one', () => {
    expect(shownCurrency(GROUPS, 'USD')).toBe('USD');
    expect(shownCurrency([GROUPS[0]], 'EUR')).toBe('IRR');
  });

  it('renders USD by default and IRR when the user switches', () => {
    const { unmount } = render(<EconomicBreakdownTable components={GROUPS} caption="Breakdown" />);
    const usdRow = screen.getAllByTestId('breakdown-row').find((el) => el.dataset.key === 'rework_cost')?.closest('tr');
    expect(usdRow && within(usdRow).getByText('600.00 USD')).toBeTruthy();
    expect(screen.getByText('Value (USD)')).toBeTruthy();
    unmount();
    render(
      <DisplayCurrencyContext.Provider value={{ currency: 'IRR', setCurrency: () => undefined }}>
        <EconomicBreakdownTable components={GROUPS} caption="Breakdown" />
      </DisplayCurrencyContext.Provider>,
    );
    expect(screen.getByText('Value (IRR)')).toBeTruthy();
    expect(screen.getByText('360,000,000 IRR')).toBeTruthy();
  });

  it('says so when there is nothing to break down', () => {
    render(<EconomicBreakdownTable components={[]} caption="Breakdown" />);
    expect(screen.getByText(/No economic value to break down/)).toBeTruthy();
  });
});
