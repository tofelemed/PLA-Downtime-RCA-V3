import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { AnalyticsResponse } from '@/api/v2/types/envelopes';
import type { LedgerTotalsView, PeriodAccountingView } from '@/api/v2/types/period-overview';
import { LedgerComparison } from './components/ledger-comparison';

const totals = (ledger: 'plan' | 'capacity', flags: string[]) => ({ sliceId: 's1', ledger, uom: 't', target: '240', flags }) as unknown as LedgerTotalsView;
const accounting = (rows: LedgerTotalsView[]) => ({ data: { totals: rows } }) as unknown as AnalyticsResponse<PeriodAccountingView>;

describe('ledger comparison status row', () => {
  it('does not show value-carrying flags as labels', () => {
    render(<LedgerComparison accounting={accounting([totals('plan', ['capacity_not_applicable', 'stops_cross_check:30:t', 'declared_shortfall:32']), totals('capacity', [])])} ledger="plan" />);
    const text = screen.getByTestId('ledger-comparison').textContent ?? '';
    expect(text).toContain('Capacity figures not available (declared basis)');
    expect(text).not.toMatch(/cross check|Declared shortfall|:30:t/i);
  });

  it('declared mode replaces the capacity ledger column with the not-available note', () => {
    render(<LedgerComparison accounting={accounting([totals('plan', []), totals('capacity', [])])} ledger="plan" declared />);
    const table = screen.getByRole('table', { name: 'Ledger totals' });
    expect(within(table).getByTestId('capacity-not-available')).toHaveTextContent('Not available: this plant accounts declared losses');
    expect(within(table).getAllByText('240.00')).toHaveLength(1);
  });
});
