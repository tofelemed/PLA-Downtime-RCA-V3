import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { ApprovedValuationView, ReconciliationView } from '@/api/v2/types/reconciliation';
import { actAs } from '@/test/acting-user';
import { valuationChoiceOf } from './model/valuation-basis';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { ValuationTiles } = await import('./components/valuation-tiles');

const FROZEN: ApprovedValuationView = {
  view: 'contribution_margin',
  policyId: 'pol-1',
  policyVersion: 1,
  current: { view: 'economic_impact', policyId: 'pol-3', policyVersion: 3 },
  differs: true,
  restatementProposalId: 'proposal-9',
};
const periodOf = (lifecycle: string, approvedValuation: ApprovedValuationView | null) =>
  ({
    periodId: 'p1', unitId: 'u1', utcStart: '2026-10-17T00:00:00.000Z', utcEnd: '2026-10-17T08:00:00.000Z', publishedRevision: 2, openProposalId: 'proposal-9',
    revision: { id: `rev-${lifecycle}`, revision: 2, lifecycle }, approvedValuation,
  }) as unknown as ReconciliationView;

const report = (metric: string, view: string, label: string) => ({
  data: {
    metric, view, label, defaultView: false, valuationStatus: 'approved', approvedPeriods: 1, periods: 1, ledger: 'plan', groupBy: 'kind', basis: '', groups: [], components: null, calculationRunIds: [],
    total: { key: 'total', currencies: [{ currency: 'USD', amount: metric === 'margin' ? '7650' : '9100', nativeAmount: '0', status: 'valued', fxProvisional: false, reasons: [] }], unvalued: [] },
  },
  isProvisional: false,
});

describe('valuationChoiceOf (owner, 18 Oct 2026)', () => {
  it('an approved revision asks for the view frozen at approval; the current view only on request', () => {
    expect(valuationChoiceOf(periodOf('approved', FROZEN), false)).toEqual({ metric: 'margin', shown: 'approved' });
    expect(valuationChoiceOf(periodOf('approved', FROZEN), true)).toEqual({ metric: 'economic_impact', shown: 'current' });
    const same = { ...FROZEN, current: { ...FROZEN.current, view: 'contribution_margin' }, differs: false };
    expect(valuationChoiceOf(periodOf('approved', same), true)).toEqual({ metric: 'margin', shown: 'approved' });
  });

  it('draft and in-review revisions show the current policy view', () => {
    expect(valuationChoiceOf(periodOf('draft', null), false)).toEqual({ metric: undefined, shown: 'current' });
    expect(valuationChoiceOf(periodOf('in_review', null), true)).toEqual({ metric: undefined, shown: 'current' });
  });
});

describe('Value section of an approved revision', () => {
  let urls: URL[];
  const wrap = (period: ReconciliationView) =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <ValuationTiles period={period} ledger="plan" approvedOnly={false} historyHref="/plans/x/periods/p1/history" />
        </MemoryRouter>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    urls = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const parsed = new URL(url);
      urls.push(parsed);
      const metric = parsed.searchParams.get('metric');
      const body = metric === 'economic_impact' ? report('economic_impact', 'economic_impact', 'Economic impact') : report('margin', 'contribution_margin', 'Commercial opportunity (contribution margin)');
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
    actAs('Manager', 'user-me');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin');
  });

  it('opens on the frozen view, notes the pending restatement with its proposal, and toggles to the current view marked not approved', async () => {
    wrap(periodOf('approved', FROZEN));
    await waitFor(() => expect(screen.getByText(/Commercial opportunity/)).toBeInTheDocument());
    expect(urls.some((u) => u.pathname.endsWith('/reports/loss-value') && u.searchParams.get('metric') === 'margin')).toBe(true);
    expect(screen.getByTestId('valuation-basis-note')).toHaveTextContent('Approved valuation view: Contribution margin, frozen at approval under valuation policy v1.');
    expect(screen.getByTestId('valuation-restatement-note')).toHaveTextContent('Restatement pending under valuation policy v3: open change proposal.');
    expect(screen.getByTestId('valuation-restatement-link')).toHaveAttribute('href', '/plans/x/periods/p1/history');
    expect(screen.getByTestId('valuation-status')).toHaveTextContent('Approved, reconciled value');
    fireEvent.click(screen.getByRole('button', { name: 'Current policy view (not approved)' }));
    await waitFor(() => expect(screen.getByText(/Loss value · Economic impact/)).toBeInTheDocument());
    expect(screen.getByTestId('valuation-current-warning')).toBeInTheDocument();
    expect(screen.getByTestId('valuation-status')).toHaveTextContent('Current policy view (not approved)');
    fireEvent.click(screen.getByRole('button', { name: 'Approved view' }));
    await waitFor(() => expect(screen.getByText(/Commercial opportunity/)).toBeInTheDocument());
  });

  it('says no restatement was opened when the approved revision has no open proposal', async () => {
    wrap(periodOf('approved', { ...FROZEN, restatementProposalId: null }));
    await waitFor(() => expect(screen.getByTestId('valuation-restatement-note')).toHaveTextContent('No restatement opened.'));
    expect(screen.queryByTestId('valuation-restatement-link')).toBeNull();
  });

  it('a matching current policy shows only the frozen view, no toggle', async () => {
    wrap(periodOf('approved', { ...FROZEN, current: { ...FROZEN.current, view: 'contribution_margin' }, differs: false }));
    await waitFor(() => expect(screen.getByTestId('valuation-basis-note')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Current policy view/ })).toBeNull();
  });

  it('a draft shows the current policy view without a note', async () => {
    wrap(periodOf('draft', null));
    await waitFor(() => expect(urls.length).toBeGreaterThan(0));
    expect(urls[0].searchParams.get('metric')).toBeNull();
    expect(screen.queryByTestId('valuation-basis-note')).toBeNull();
  });
});
