import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { RcaPortfolioRowView, RcaPortfolioView } from '@/api/v2/types/rca-portfolio';
import { DisplayCurrencyContext } from '@/features/display-currency/display-currency-context';
import type { DisplayCurrency } from '@/features/display-currency/display-currency-store';
import { actAs } from '@/test/acting-user';
import { caseHref, paramsFromPortfolioFilters, portfolioCasesHref, portfolioFiltersFromParams, portfolioQuery } from './portfolio-model';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { PortfolioPage } = await import('./portfolio-page');
const { KpiSection } = await import('@/features/pla-analytics/dashboard/kpi-section');
const { useReliabilityLinks } = await import('@/features/pla-analytics/dashboard/reliability-links');

function ReliabilityHeader() {
  return <KpiSection title="Asset reliability" links={useReliabilityLinks()}>{null}</KpiSection>;
}

const UNIT = '11111111-1111-4111-8111-111111111111';
const NOW = Date.parse('2026-10-20T10:00:30Z');
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const value = (currency: string, amount: string | null) =>
  ({ currency, amount, valuedLines: 2, unvaluedLines: 0, provisionalLines: 0, status: amount === null ? 'unvalued' : 'valued', fxProvisional: false }) as const;

const row = (key: string, overrides: Partial<RcaPortfolioRowView> = {}): RcaPortfolioRowView => ({
  key,
  causeCode: { id: key, code: `RC-${key}`, name: `Cause ${key}`, active: true },
  cases: { total: 2, byStatus: [{ status: 'Closed', count: 1 }, { status: 'Monitoring', count: 1 }], sample: [{ id: `case-${key}`, title: `Trip ${key}`, status: 'Closed' }] },
  approvedLoss: { lines: 3, values: [value('USD', '1500.5')] },
  actions: { total: 4, open: 2, overdue: 1, done: 1, cancelled: 1 },
  effectiveness: { effective: 1, notEffective: 0, insufficientEvidence: 0, pending: 2 },
  claimedAvoided: [{ currency: 'USD', amount: '900', actions: 1 }],
  claimsInOtherCurrencies: 1,
  realized: [{ metric: 'recurrences', difference: '3', cases: 1 }],
  ...overrides,
});

const page = (items: RcaPortfolioRowView[], nextCursor: string | null): RcaPortfolioView => ({
  items,
  nextCursor,
  window: { from: '2026-07-22T10:01:00.000Z', to: '2026-10-20T10:01:00.000Z' },
  causeKind: 'root',
  currency: 'USD',
  view: 'contribution_margin',
  basis: 'approved plan lines of the latest approved revision of each period',
  note: 'Approved loss, claimed avoided loss and realised difference are separate figures; they are never added together.',
  asOf: '2026-10-20T10:00:00Z',
});

describe('item 2.1 cause portfolio', () => {
  let urls: URL[];
  const renderAt = (path: string, currency: DisplayCurrency = 'USD', node: ReactNode = <PortfolioPage />) =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <DisplayCurrencyContext.Provider value={{ currency, setCurrency: () => undefined }}>
          <MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>
        </DisplayCurrencyContext.Provider>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    actAs('SuperAdmin', 'u-1');
    urls = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const parsed = new URL(url);
        urls.push(parsed);
        if (!parsed.pathname.endsWith('/reports/rca-portfolio')) return json({ items: [], nextCursor: null });
        const uncoded = row('uncoded', { causeCode: null, approvedLoss: { lines: 0, values: [] }, claimedAvoided: [], claimsInOtherCurrencies: 0, realized: [] });
        return json(parsed.searchParams.get('cursor') === 'next' ? page([uncoded], null) : page([row('b', { cases: { ...row('b').cases, total: 1 } }), row('a')], 'next'));
      }),
    );
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('filters come from the URL with safe defaults; the query is a minute-stable window in the display currency', () => {
    expect(portfolioFiltersFromParams(new URLSearchParams('days=7&causeKind=x&unitId=bad'))).toEqual({ days: 90, causeKind: 'root', unitId: '' });
    const chosen = portfolioFiltersFromParams(new URLSearchParams(`days=365&causeKind=direct&unitId=${UNIT}`));
    expect(paramsFromPortfolioFilters(chosen)).toEqual({ days: '365', causeKind: 'direct', unitId: UNIT });
    expect(portfolioQuery(chosen, 'IRR', NOW)).toEqual({ from: '2025-10-20T10:01:00.000Z', to: '2026-10-20T10:01:00.000Z', causeKind: 'direct', currency: 'IRR', unitIds: [UNIT] });
    expect(portfolioQuery(portfolioFiltersFromParams(new URLSearchParams()), 'EUR', NOW).currency).toBe('USD');
    expect(portfolioCasesHref('cc-1')).toBe('/rca?causeCodeId=cc-1');
    expect(portfolioCasesHref(null)).toBeNull();
    expect(caseHref('c 1', 'links')).toBe('/rca/c%201/links');
  });

  it('shows the server rows in order with separate figures, drills to cases, and loads the next page', async () => {
    renderAt('/reliability/portfolio?causeKind=direct');
    await screen.findByTestId('portfolio');
    const request = urls.find((url) => url.pathname.endsWith('/v2/reports/rca-portfolio'));
    expect(request?.searchParams.get('causeKind')).toBe('direct');
    expect(request?.searchParams.get('currency')).toBe('USD');
    const drills = screen.getAllByTestId('portfolio-drill');
    expect(drills.map((link) => link.dataset.code)).toEqual(['RC-b', 'RC-a']);
    expect(drills[1]).toHaveAttribute('href', '/rca?causeCodeId=a');
    const first = screen.getAllByRole('row')[1];
    expect(within(first).getByTestId('portfolio-approved')).toHaveTextContent('1,500.50 USD');
    expect(within(first).getByTestId('portfolio-claimed')).toHaveTextContent('900.00 USD');
    expect(within(first).getByTestId('portfolio-claimed')).toHaveTextContent('+1 in another currency');
    expect(within(first).getByTestId('portfolio-realized')).toHaveTextContent('3.00 recurrences');
    expect(within(first).getByTestId('portfolio-actions')).toHaveTextContent('1 overdue');
    expect(within(first).getByRole('link', { name: 'Loss lines and events of Trip b' })).toHaveAttribute('href', '/rca/case-b/links');
    // never a client total of the three figures (1,500.50 + 900 = 2,400.50)
    expect(screen.queryByText(/2,400/)).toBeNull();
    fireEvent.click(screen.getByTestId('portfolio-more'));
    await waitFor(() => expect(screen.getByText(/Uncoded/)).toBeInTheDocument());
    expect(urls.some((url) => url.searchParams.get('cursor') === 'next')).toBe(true);
    expect(screen.queryByTestId('portfolio-more')).toBeNull();
  });

  it('IRR display currency asks for IRR; a value missing in that currency is said, never converted', async () => {
    renderAt('/reliability/portfolio', 'IRR');
    await screen.findByTestId('portfolio');
    const request = urls.find((url) => url.pathname.endsWith('/v2/reports/rca-portfolio'));
    expect(request?.searchParams.get('currency')).toBe('IRR');
    expect(screen.getAllByText('Not reported in IRR').length).toBeGreaterThan(0);
    expect(screen.queryByText(/1,500/)).toBeNull();
  });

  it('leaves the money columns out for a role without money', async () => {
    actAs('Operator', 'u-2');
    renderAt('/reliability/portfolio');
    await screen.findByTestId('portfolio');
    expect(screen.queryByTestId('portfolio-approved')).toBeNull();
    expect(screen.queryByTestId('portfolio-claimed')).toBeNull();
    expect(screen.queryByRole('columnheader', { name: /Approved loss|Claimed avoided/ })).toBeNull();
    expect(screen.getAllByTestId('portfolio-actions').length).toBeGreaterThan(0);
  });

  it('the dashboard Asset reliability header links to the portfolio for analysis roles', () => {
    renderAt('/dashboard', 'USD', <ReliabilityHeader />);
    expect(screen.getByTestId('dashboard-rca-portfolio')).toHaveAttribute('href', '/reliability/portfolio');
  });

  it('cleanup: title only, Unit first in one labelled row, the server note and value basis behind the card ⓘ', async () => {
    renderAt('/reliability/portfolio');
    await screen.findByTestId('portfolio');
    expect(screen.queryByText(/Approved loss linked to investigations by coded cause/)).toBeNull();
    expect(screen.queryByText(/never added together/)).toBeNull();
    expect(screen.queryByText(/Value basis/)).toBeNull();
    const card = screen.getByRole('region', { name: 'Loss, cause, action and outcome' });
    fireEvent.focus(within(card).getByRole('button', { name: 'About Loss, cause, action and outcome' }));
    expect((await screen.findAllByTestId('portfolio-note'))[0].textContent).toMatch(/never added together.*Value basis: Contribution margin/);
    const labels = Array.from(screen.getByTestId('portfolio-controls').querySelectorAll('label')).map((label) => label.textContent);
    expect(labels).toEqual(['Unit', 'Group by', 'Investigations opened']);
    expect(screen.getByRole('option', { name: 'Last 90 days' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Approved loss' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Claimed avoided' })).toBeInTheDocument();
    // more pages to load: no count of the loaded rows in the title
    expect(within(card).queryByTestId('portfolio-count')).toBeNull();
  });

  it('a window without investigations keeps its own empty message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(page([], null))));
    renderAt('/reliability/portfolio');
    expect(await screen.findByText('No investigation was opened in this window.')).toBeInTheDocument();
    expect(screen.queryByText('No data for these dates')).toBeNull();
    expect(screen.getByTestId('portfolio-count')).toHaveTextContent('(0)');
  });
});

