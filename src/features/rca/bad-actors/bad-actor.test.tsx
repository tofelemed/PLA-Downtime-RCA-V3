import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { BadActorReportView } from '@/api/v2/types/bad-actors';
import { actAs } from '@/test/acting-user';
import { badActorQuery, currentPlantMonth, failureModeText, filtersFromParams } from './bad-actor-model';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { BadActorPage } = await import('./bad-actor-page');

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const REPORT: BadActorReportView = {
  month: '2027-03', from: '2027-01-01T00:00:00.000Z', to: '2027-04-01T00:00:00.000Z', windowDays: 90, groupBy: 'asset', rankBy: 'quantity', limit: 5,
  view: 'economic_impact', currency: 'USD', uom: 't', valuationStatus: 'approved', approvedPeriods: 3, periods: 3, basis: 'approved plan lines',
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

describe('CA8 bad-actor review', () => {
  let urls: URL[];
  beforeEach(() => {
    actAs('SuperAdmin', 'u-1');
    urls = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      urls.push(new URL(url));
      return json(200, { data: REPORT, calculationRunId: null, policyVersion: null, dataQuality: { missingCount: 0, provisionalCount: 0, notes: [] }, coverage: { from: REPORT.from, to: REPORT.to, ratio: 1 }, isProvisional: false, asOf: '2027-04-01T00:00:00Z', scope: { tenantId: 'tenant-a' } });
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('filters come from the URL with safe defaults; the money column follows the display currency (USD default)', () => {
    expect(filtersFromParams(new URLSearchParams('month=2027-3&rankBy=x&limit=7'), '2027-03')).toEqual({ month: '2027-03', groupBy: 'asset', rankBy: 'quantity', limit: 5 });
    expect(badActorQuery({ month: '2027-03', groupBy: 'failure_mode', rankBy: 'stops', limit: 10 }, 'IRR')).toEqual({ month: '2027-03', groupBy: 'failure_mode', rankBy: 'stops', limit: 10, currency: 'IRR' });
    expect(currentPlantMonth('Asia/Tehran', new Date('2027-03-31T21:00:00Z'))).toBe('2027-04');
    expect(failureModeText('mode:seal leak')).toBe('seal leak');
    expect(failureModeText('reason:r1')).toMatch(/Reason code/);
  });

  it('asks the server for the ranking and shows its rows as sent: provisional rate, unvalued, trigger state and case link', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/reliability/bad-actors?month=2027-03&rankBy=quantity']}>
          <BadActorPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByTestId('bad-actor-report');
    const request = urls.find((url) => url.pathname.endsWith('/v2/reports/bad-actors'));
    expect(request?.searchParams.get('month')).toBe('2027-03');
    expect(request?.searchParams.get('currency')).toBe('USD');
    expect(screen.getAllByTestId('bad-actor-asset').map((cell) => cell.dataset.key)).toEqual(['a1', 'p1']);
    const values = screen.getAllByTestId('bad-actor-value');
    expect(values[0].textContent).toMatch(/provisional exchange rate/);
    expect(values[1].textContent).toContain('Not valued');
    expect(screen.getAllByTestId('bad-actor-trigger').map((cell) => cell.dataset.state)).toEqual(['over_threshold', 'fired']);
    expect(screen.getByText('Open the case').getAttribute('href')).toBe('/rca/c9');
    fireEvent.change(screen.getByLabelText('Rank by'), { target: { value: 'stops' } });
    await waitFor(() => expect(urls.some((url) => url.searchParams.get('rankBy') === 'stops')).toBe(true));
  });
});
