import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { RcaCauseReportView } from '@/api/v2/types/rca-cause-report';
import { DisplayCurrencyContext } from '@/features/display-currency/display-currency-context';
import type { DisplayCurrency } from '@/features/display-currency/display-currency-store';
import { actAs } from '@/test/acting-user';
import { causeCasesHref, causeReportQuery, filtersFromParams, paramsFromFilters } from './cause-report-model';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { CauseReportPage } = await import('./cause-report-page');

const UNIT = '11111111-1111-4111-8111-111111111111';
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const value = (currency: string, amount: string | null) => ({
  currency, amount, valuedLines: amount === null ? 0 : 2, unvaluedLines: amount === null ? 2 : 0, provisionalLines: 0, status: amount === null ? 'unvalued' : 'valued', fxProvisional: false,
}) as const;

// the server's order: fewer cases first on purpose, so a client re-sort by cases would be visible
const REPORT: RcaCauseReportView = {
  view: 'contribution_margin',
  basis: 'approved plan lines of the latest approved revision of each period',
  asOf: '2026-10-19T00:00:00Z',
  items: [
    { causeCodeId: 'cc-1', code: 'MIS-01', name: 'Coupling misalignment', active: true, cases: 2, causes: 3, approvedLoss: { lines: 2, values: [value('USD', '1500.5'), value('IRR', '63000000')] } },
    { causeCodeId: 'cc-2', code: 'LUB-02', name: 'Lubrication starvation', active: false, cases: 5, causes: 5, approvedLoss: { lines: 2, values: [value('USD', null), value('IRR', null)] } },
    { causeCodeId: 'cc-3', code: 'OPS-03', name: 'Start-up procedure', active: true, cases: 1, causes: 1, approvedLoss: { lines: 0, values: [] } },
  ],
};

describe('item 1.1 recurring-cause ranking', () => {
  let urls: URL[];
  let report: RcaCauseReportView;
  const renderAt = (path: string, currency: DisplayCurrency = 'USD', node: ReactNode = <CauseReportPage />) =>
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
    report = REPORT;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const parsed = new URL(url);
      urls.push(parsed);
      return json(parsed.pathname.endsWith('/reports/rca-causes') ? report : { items: [], nextCursor: null });
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('filters come from the URL with safe defaults; the query follows the display currency (USD default)', () => {
    expect(filtersFromParams(new URLSearchParams('kind=bogus&unitId=x&sort=y'))).toEqual({ kind: 'all', unitId: '', sort: 'cases' });
    const chosen = filtersFromParams(new URLSearchParams(`kind=root&unitId=${UNIT}&sort=approvedLoss`));
    expect(paramsFromFilters(chosen)).toEqual({ kind: 'root', unitId: UNIT, sort: 'approvedLoss' });
    expect(causeReportQuery(chosen, 'IRR')).toEqual({ kind: 'root', unitId: UNIT, sort: 'approvedLoss', currency: 'IRR' });
    expect(causeReportQuery(filtersFromParams(new URLSearchParams()), 'EUR')).toEqual({ sort: 'cases', currency: 'USD' });
    expect(causeCasesHref('cc-1')).toBe('/rca?causeCodeId=cc-1');
  });

  it('shows the rows in the server order with the server figures only, and drills to the cases', async () => {
    renderAt('/reliability/causes?kind=root');
    await screen.findByTestId('cause-report');
    const request = urls.find((url) => url.pathname.endsWith('/v2/reports/rca-causes'));
    expect(request?.searchParams.get('kind')).toBe('root');
    expect(request?.searchParams.get('currency')).toBe('USD');
    const links = screen.getAllByTestId('cause-report-cases');
    expect(links.map((link) => link.dataset.code)).toEqual(['MIS-01', 'LUB-02', 'OPS-03']);
    expect(links[0]).toHaveAttribute('href', '/rca?causeCodeId=cc-1');
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[1]).getByTestId('cause-report-retired')).toHaveTextContent('Retired');
    expect(within(rows[0]).queryByTestId('cause-report-retired')).toBeNull();
    const losses = screen.getAllByTestId('cause-report-loss');
    expect(losses[0]).toHaveTextContent('1,500.50 USD');
    expect(losses[0]).not.toHaveTextContent('IRR');
    expect(losses[1]).toHaveTextContent('Not valued');
    expect(rows[2]).toHaveTextContent('No approved loss');
    // no client total: 8 cases or 9 causes in all are never shown
    expect(screen.queryByText(/\b(8|9)\b/)).toBeNull();
  });

  it('IRR display currency asks for and shows IRR; ranking by approved loss is the server sort', async () => {
    renderAt('/reliability/causes?sort=approvedLoss', 'IRR');
    await screen.findByTestId('cause-report');
    expect(screen.getAllByTestId('cause-report-loss')[0]).toHaveTextContent('63,000,000 IRR');
    const request = urls.find((url) => url.pathname.endsWith('/v2/reports/rca-causes'));
    expect(request?.searchParams.get('sort')).toBe('approvedLoss');
    expect(request?.searchParams.get('currency')).toBe('IRR');
    fireEvent.change(screen.getByLabelText('Cause kind'), { target: { value: 'contributing' } });
    await waitFor(() => expect(urls.some((url) => url.searchParams.get('kind') === 'contributing')).toBe(true));
  });

  it('says so when no investigation names a coded cause', async () => {
    report = { items: [], view: null, basis: null, asOf: '2026-10-19T00:00:00Z' };
    renderAt('/reliability/causes');
    expect(await screen.findByText(/names a cause code of the library yet/)).toBeInTheDocument();
    expect(screen.queryByTestId('cause-report-cases')).toBeNull();
  });
});
