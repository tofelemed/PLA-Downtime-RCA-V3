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

const PLAN = {
  id: 'plan1', name: 'Extruder1 HD5502', currentVersion: 1,
  version: { id: 'v1', planId: 'plan1', version: 1, unitId: 'u1', validFrom: '2026-10-17T02:30:00.000Z', validTo: '2026-10-18T02:30:00.000Z', basis: 'quantity', approvalState: 'draft', slices: [] },
};
const PERIOD = { periodId: 'p1', unitId: 'u1', utcStart: '2026-10-17T02:30:00.000Z', utcEnd: '2026-10-17T10:30:00.000Z', localDate: '2026-10-17', shiftName: 'Day', workflowState: 'draft', coverageRatio: null, plan: null, sla: null, qualityStates: [], stateReadiness: 'ready' };

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('Plan period list cleanup', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const path = String(url);
      if (/production-plans\/plan1/.test(path) && !path.includes('?')) return json(PLAN);
      if (path.includes('period-summaries')) return json({ items: [PERIOD], nextCursor: null });
      return json({ items: [], nextCursor: null });
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
    actAs('SuperAdmin');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('drops the scope line, caption paragraph and zone suffixes; keeps the plan state, periods and filters', async () => {
    const { PlanDashboardPage } = await import('./plan-dashboard-page');
    const { Route, Routes } = await import('react-router-dom');
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/plans/plan1']}>
          <Routes><Route path="/plans/:planId" element={<PlanDashboardPage />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('period-row')).toBeTruthy());
    expect(screen.queryByTestId('scope-header')).toBeNull();
    expect(screen.queryByText(/Plan ledger\. Attributed/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/Asia\/Tehran|\+03:30/);
    expect(screen.getByTestId('version-state').getAttribute('data-state')).toBe('draft');
    expect(screen.getByRole('button', { name: 'About Production periods' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /Production periods/ })).toBeTruthy();
    expect(screen.getByLabelText('Go to date')).toBeTruthy();
  });
});
