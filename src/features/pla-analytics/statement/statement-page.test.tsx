import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { LossStatementRowView, LossStatementView } from '@/api/v2/types/loss-statement';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ session: { tenant: { id: 'tenant-a' } } }) }));
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/features/event-hub/use-event-hub-env', () => ({ useEventHubEnv: () => ({ timezone: 'Asia/Tehran', units: [], unitName: (id: string) => `Unit ${id}` }) }));

const OWNER: LossStatementView = {
  planned: '240',
  actual: '208',
  shortfall: '32',
  availability: '23',
  performance: '11',
  quality: '6',
  transitionExcess: '0',
  unaccountedClassified: '0',
  grossAttributed: '40',
  recovery: '8',
  recoveryVerified: true,
  netAccounted: '32',
  toleranceAdjustment: '0',
  unaccounted: '0',
  uom: 't',
  revisionState: 'provisional',
};

const row = (periodId: string, over: Partial<LossStatementRowView> = {}): LossStatementRowView => ({
  periodId,
  planId: 'plan-1',
  unitId: 'u1',
  unitName: 'HDPE Train',
  localDate: '2026-10-29',
  shiftName: null,
  grain: 'day',
  basis: 'declared',
  revisionState: 'provisional',
  statement: OWNER,
  ...over,
});

const ROWS = [row('p-28', { localDate: '2026-10-28' }), row('p-29')];
let asked: unknown[] = [];
vi.mock('@/api/v2/queries/loss-statement', () => ({
  useLossStatement: (query: unknown) => {
    asked.push(query);
    return {
      data: { pages: [{ data: { total: OWNER, incomplete: 1, items: ROWS, nextCursor: null }, isProvisional: true, dataQuality: { missingCount: 0, provisionalCount: 1, notes: ['incomplete_periods'] } }] },
      isLoading: false,
      isError: false,
      error: null,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      refetch: vi.fn(),
    };
  },
  fetchAllStatementRows: vi.fn(),
}));

const { parseScope } = await import('../model/analytics-scope');
const { StatementPage } = await import('./statement-page');

const SEARCH = 'from=2026-10-28T02:30:00.000Z&to=2026-10-30T02:30:00.000Z&window=dates&units=u1';

function renderPage(search = SEARCH) {
  const scope = parseScope(new URLSearchParams(search), 0);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[`/pla-analytics/statement?${search}`]}>
        <StatementPage scope={scope} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PLA Accounting statement page (Task 13)', () => {
  it('asks the server for the scope (provisional by default) and shows its total as the statement', () => {
    asked = [];
    renderPage();
    expect(asked[0]).toMatchObject({ from: '2026-10-28T02:30:00.000Z', to: '2026-10-30T02:30:00.000Z', unitIds: ['u1'] });
    const total = within(screen.getByTestId('statement-total'));
    expect(total.getAllByTestId('statement-row').map((r) => r.getAttribute('data-key'))).toEqual([
      'planned', 'actual', 'shortfall', 'availability', 'performance', 'quality', 'grossAttributed', 'recovery', 'netAccounted', 'unaccounted',
    ]);
    expect(screen.getByTestId('statement-incomplete')).toHaveTextContent('1 period is not in the total');
    expect(screen.getByTestId('statement-export-start')).toBeDisabled();
  });

  it('lists one row per day with the ten figures; a row expands to its statement and the period link', () => {
    renderPage();
    const rows = screen.getAllByTestId('statement-table-row');
    expect(rows).toHaveLength(2);
    const cells = within(rows[1]).getAllByTestId(/^statement-cell-/).map((cell) => cell.textContent);
    expect(cells).toEqual(['240.000', '208.000', '32.000', '23.000', '11.000', '6.000', '40.000', '−8.000', '32.000', '0.000']);
    expect(screen.queryByTestId('statement-expansion')).toBeNull();
    fireEvent.click(within(rows[1]).getByTestId('statement-row-toggle'));
    const expansion = screen.getByTestId('statement-expansion');
    expect(within(expansion).getByTestId('statement-period-link')).toHaveAttribute('href', '/plans/plan-1/periods/p-29');
    expect(within(expansion).getAllByTestId('statement-row')).toHaveLength(10);
  });

  it('focus=<period> opens that row expanded; source=event:<id> links back to the event', () => {
    renderPage(`${SEARCH}&focus=p-29&source=event:e-7`);
    expect(screen.getByTestId('statement-expansion')).toHaveAttribute('data-period-id', 'p-29');
    expect(screen.getAllByTestId('statement-table-row')[1]).toHaveAttribute('data-focused', 'true');
    expect(screen.getByTestId('statement-back-to-event')).toHaveAttribute('href', '/events/e-7');
  });

  it('Approved only is sent as the revision; provisional figures still block the export', () => {
    asked = [];
    renderPage(`${SEARCH}&approved=1`);
    expect(asked[0]).toMatchObject({ approvedOnly: true });
    expect(screen.getByTestId('statement-export-start')).toBeDisabled();
  });
});
