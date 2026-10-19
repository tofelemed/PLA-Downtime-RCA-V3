import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { BadActorItemView, BadActorReportView } from '@/api/v2/types/bad-actors';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { BadActorTable } = await import('./bad-actor-table');

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

const item = (key: string, failureMode: string): BadActorItemView => ({
  rank: 1, key, assetId: 'a1', assetCode: 'EXT1-Main', assetName: 'Main drive and gearbox', unitId: 'u1', failureMode, stops: 1, downtimeSeconds: '3600',
  quantities: [{ uom: 't', quantity: '28' }], quantity: '28', value: { currency: 'USD', amount: '4200', status: 'valued', fxProvisional: false },
  trigger: { state: 'below', seconds: 3600, thresholdSeconds: 28800, windowDays: 90, criticalAsset: false, firedAt: null, rcaId: 'c1', outcome: null },
});

const REPORT: BadActorReportView = {
  month: '2026-10', calendar: 'gregorian', from: '2026-08-03T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z', windowDays: 90, groupBy: 'failure_mode', rankBy: 'quantity', limit: 5,
  view: 'contribution_margin', currency: 'USD', uom: 't', valuationStatus: 'approved', approvedPeriods: 3, periods: 3, basis: 'approved plan lines',
  items: [item('a1|mode:gearbox_failure', 'mode:gearbox_failure'), item('a1|mode:seal leak', 'mode:seal leak')],
};

const DICTIONARY = [{ id: 'd1', kind: 'failure_mode', equipmentClass: '', code: 'GEARBOX_FAILURE', name: 'Gearbox failure (dictionary)', description: null, category: null, assetTypes: [], isPending: false, effectiveFrom: '2026-01-01', effectiveTo: null, rowVersion: 1 }];

describe('bad-actor table (QA PLA M5 / M6, unit spacing)', () => {
  beforeEach(() => {
    actAs('SuperAdmin', 'u-1');
    vi.stubGlobal('fetch', vi.fn(async () => json({ items: DICTIONARY, nextCursor: null })));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('names failure modes from the dictionary, else in words; money and quantities keep a space before the unit; the scroll box is a focusable region', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <BadActorTable report={REPORT} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByText('Gearbox failure (dictionary)')).toBeInTheDocument());
    expect(screen.getByText('Seal leak')).toBeInTheDocument();
    expect(screen.queryByText(/gearbox_failure/)).toBeNull();
    expect(screen.getAllByTestId('bad-actor-value')[0].textContent).toBe('4,200.00 USD');
    expect(screen.getAllByText('28.00', { exact: false })[0].textContent).toBe('28.00 t');
    const region = screen.getByRole('region', { name: /Bad actors/ });
    expect(region.getAttribute('tabindex')).toBe('0');
  });
});
