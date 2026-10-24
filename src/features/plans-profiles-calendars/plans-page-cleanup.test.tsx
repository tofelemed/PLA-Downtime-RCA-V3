import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/api/v2/queries/use-v2-tenant', () => ({ useV2TenantId: () => 'tenant-a' }));
vi.mock('@/features/ux-kit/use-plant-timezone', () => ({ usePlantTimezone: () => ({ timezone: 'Asia/Tehran', source: 'plant' }) }));

const { PlanningPage } = await import('./planning-page');

const PLAN = {
  id: 'plan-1', name: 'Extruder1 HD5502', currentVersion: 1,
  version: { id: 'v1', planId: 'plan-1', version: 1, unitId: 'u1', validFrom: '2026-10-17T02:30:00.000Z', validTo: '2026-10-18T02:30:00.000Z', basis: 'quantity', approvalState: 'approved', slices: [] },
};

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('Plans page cleanup', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => json(String(url).includes('production-plans') ? { items: [PLAN], nextCursor: null } : { items: [], nextCursor: null })));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
    actAs('SuperAdmin');
  });
  afterEach(() => vi.unstubAllGlobals());

  const open = () =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/planning']}>
          <PlanningPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

  it('drops the description, scope line and timezone suffixes but keeps the data and actions', async () => {
    open();
    await waitFor(() => expect(screen.getByTestId('plan-row')).toBeTruthy());
    expect(screen.queryByText(/Versioned production plans/)).toBeNull();
    expect(screen.queryByTestId('scope-header')).toBeNull();
    expect(document.body.textContent).not.toMatch(/Asia\/Tehran|\+03:30/);
    expect(screen.getByText('Extruder1 HD5502')).toBeTruthy();
    expect(screen.getByTestId('plan-periods-link')).toBeTruthy();
    expect(screen.getByLabelText('Unit')).toBeTruthy();
    expect(screen.getByLabelText('Current version')).toBeTruthy();
  });

  it('puts New plan beside the title and the table in a titled card', async () => {
    open();
    await waitFor(() => expect(screen.getByTestId('plan-row')).toBeTruthy());
    const header = screen.getByRole('heading', { level: 1 }).parentElement?.parentElement;
    expect(header?.querySelector('[data-testid="plan-new"]')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /Production plans/ })).toBeTruthy();
  });
});
