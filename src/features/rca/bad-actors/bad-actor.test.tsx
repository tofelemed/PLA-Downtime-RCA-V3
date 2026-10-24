import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { BadActorReportView } from '@/api/v2/types/bad-actors';
import { actAs } from '@/test/acting-user';
import { CalendarPreferenceContext, currentPlantMonth, shiftPlantMonth } from '@/lib/dates';
import { badActorQuery, failureModeText, filtersFromParams } from './bad-actor-model';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { BadActorPage } = await import('./bad-actor-page');
const { PlantMonthInput } = await import('@/features/ux-kit/date-inputs/plant-month-input');

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const REPORT: BadActorReportView = {
  month: '2027-03', calendar: 'gregorian', from: '2027-01-01T00:00:00.000Z', to: '2027-04-01T00:00:00.000Z', windowDays: 90, groupBy: 'asset', rankBy: 'quantity', limit: 5,
  view: 'economic_impact', currency: 'USD', uom: 't', valuationStatus: 'approved', approvedPeriods: 3, periods: 3, uncoveredPeriods: 0, basis: 'approved plan lines',
  items: [
    {
      rank: 1, key: 'a1', assetId: 'a1', assetCode: 'EXT-1', assetName: 'Extruder', unitId: 'u1', failureMode: null, stops: 10, downtimeSeconds: '9000',
      quantities: [{ uom: 't', quantity: '100' }], quantity: '100', value: { currency: 'USD', amount: '30000', status: 'valued', fxProvisional: true },
      trigger: { state: 'over_threshold', seconds: 32400, thresholdSeconds: 28800, windowDays: 90, criticalAsset: false, firedAt: null, rcaId: null, outcome: null },
    },
    {
      rank: 2, key: 'p1', assetId: 'p1', assetCode: 'P-101', assetName: 'Feed pump', unitId: 'u1', failureMode: null, stops: 2, downtimeSeconds: '19800',
      quantities: [{ uom: 't', quantity: '60' }], quantity: '60', value: { currency: 'USD', amount: null, status: 'unvalued', fxProvisional: false },
      trigger: { state: 'fired', seconds: 19800, thresholdSeconds: 14400, windowDays: 90, criticalAsset: true, firedAt: '2027-03-21T13:00:00.000Z', rcaId: 'c9', outcome: 'recommended' },
    },
  ],
};

const renderPage = (path = '/reliability/bad-actors?month=2027-03&rankBy=quantity') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <BadActorPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('CA8 bad-actor review', () => {
  let urls: URL[];
  let report: BadActorReportView;
  beforeEach(() => {
    actAs('SuperAdmin', 'u-1');
    urls = [];
    report = REPORT;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      urls.push(new URL(url));
      return json(200, { data: report, calculationRunId: null, policyVersion: null, dataQuality: { missingCount: 0, provisionalCount: 0, notes: [] }, coverage: { from: REPORT.from, to: REPORT.to, ratio: 1 }, isProvisional: false, asOf: '2027-04-01T00:00:00Z', scope: { tenantId: 'tenant-a' } });
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('filters come from the URL with safe defaults; the money column follows the display currency (USD default)', () => {
    expect(filtersFromParams(new URLSearchParams('month=2027-3&rankBy=x&limit=7'), '2027-03')).toEqual({ month: '2027-03', groupBy: 'asset', rankBy: 'quantity', limit: 5 });
    expect(badActorQuery({ month: '2027-03', groupBy: 'failure_mode', rankBy: 'stops', limit: 10 }, 'IRR')).toEqual({ month: '2027-03', groupBy: 'failure_mode', rankBy: 'stops', limit: 10, currency: 'IRR' });
    expect(currentPlantMonth('Asia/Tehran', 'gregorian', new Date('2027-03-31T21:00:00Z'))).toBe('2027-04');
    // a Persian plant reviews Jalali months: 2026-10-15 is in Mehr 1405; one month back is Shahrivar
    expect(currentPlantMonth('Asia/Tehran', 'persian', new Date('2026-10-15T08:00:00Z'))).toBe('1405-07');
    expect(shiftPlantMonth('1405-01', 1)).toBe('1404-12');
    expect(failureModeText('mode:seal leak')).toBe('seal leak');
    expect(failureModeText('reason:r1')).toMatch(/Reason code/);
  });

  it('a Persian plant picks Jalali months with its digits; the value stays the YYYY-MM the server reads', () => {
    const picked: string[] = [];
    render(
      <CalendarPreferenceContext.Provider value={{ calendar: 'persian', digits: 'persian' }}>
        <PlantMonthInput id="m" value="1405-07" latest="1405-07" onChange={(month) => picked.push(month)} />
      </CalendarPreferenceContext.Provider>,
    );
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.options[0].textContent).toBe('Mehr ۱۴۰۵');
    expect(select.options[1].textContent).toBe('Shahrivar ۱۴۰۵');
    fireEvent.change(select, { target: { value: '1405-06' } });
    expect(picked).toEqual(['1405-06']);
  });

  it('asks the server for the ranking and shows its rows as sent: provisional rate, unvalued, trigger state and case link', async () => {
    renderPage();
    await screen.findByTestId('bad-actor-report');
    const request = urls.find((url) => url.pathname.endsWith('/v2/reports/bad-actors'));
    expect(request?.searchParams.get('month')).toBe('2027-03');
    expect(request?.searchParams.get('currency')).toBe('USD');
    expect(screen.getAllByTestId('bad-actor-asset').map((cell) => cell.dataset.key)).toEqual(['a1', 'p1']);
    expect(screen.getAllByTestId('bad-actor-asset')[1].getAttribute('href')).toContain('assets=p1');
    const values = screen.getAllByTestId('bad-actor-value');
    expect(values[0].textContent).toMatch(/provisional exchange rate/);
    expect(values[1].textContent).toContain('Not valued');
    expect(screen.getAllByTestId('bad-actor-trigger').map((cell) => cell.dataset.state)).toEqual(['over_threshold', 'fired']);
    expect(screen.getByTestId('event-rca-chip').getAttribute('href')).toBe('/rca/c9');
    expect(screen.getByTestId('event-rca-chip').textContent).toContain('Investigation linked');
    fireEvent.change(screen.getByLabelText('Rank by'), { target: { value: 'stops' } });
    await waitFor(() => expect(urls.some((url) => url.searchParams.get('rankBy') === 'stops')).toBe(true));
  });

  it('cleanup: title only, filters in one labelled row, the window and value basis behind the card ⓘ', async () => {
    renderPage();
    await screen.findByTestId('bad-actor-report');
    expect(screen.queryByText(/Monthly review of the assets/)).toBeNull();
    expect(screen.queryByText(/plant dates/)).toBeNull();
    expect(screen.queryByText(/Value basis/)).toBeNull();
    expect(screen.queryByText(/approved plan lines/)).toBeNull();
    const card = screen.getByRole('region', { name: 'Top bad actors' });
    fireEvent.focus(within(card).getByRole('button', { name: 'About Top bad actors' }));
    expect((await screen.findAllByTestId('bad-actor-window'))[0].textContent).toMatch(/Rolling 90 days: .+ \(both included\)\. Value basis: /);
    expect(within(card).getByTestId('bad-actor-count')).toHaveTextContent('(2)');
    const labels = Array.from(screen.getByTestId('bad-actor-controls').querySelectorAll('label')).map((label) => label.textContent);
    expect(labels).toEqual(['Group by', 'Rank by', 'Top', 'Review month']);
    expect(screen.queryByText('Approved value (USD)')).toBeNull();
    expect(screen.getByRole('columnheader', { name: 'Approved value' })).toBeInTheDocument();
  });

  it('says which periods the approved figures leave out, on the card', async () => {
    report = { ...REPORT, valuationStatus: 'provisional', periods: 30, approvedPeriods: 10, uncoveredPeriods: 20 };
    renderPage();
    expect(await screen.findByTestId('bad-actor-excluded')).toHaveTextContent('20 periods not included: No approved plan covers these periods');
  });

  it('a window without approved loss or stops keeps its own empty message', async () => {
    report = { ...REPORT, items: [] };
    renderPage();
    expect(await screen.findByText('No approved loss or stops in this window.')).toBeInTheDocument();
    expect(screen.queryByText('No data for these dates')).toBeNull();
  });
});
