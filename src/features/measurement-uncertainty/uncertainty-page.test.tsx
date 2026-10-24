import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { UncertaintyBudgetView } from '@/api/v2/types/uncertainty';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/features/ux-kit/use-plant-timezone', () => ({ usePlantTimezone: () => ({ timezone: 'Asia/Tehran', source: 'tenant', loading: false }) }));

const { UncertaintyPage } = await import('./uncertainty-page');

interface Call {
  method: string;
  url: URL;
  body: Record<string, unknown> | null;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const PROPOSED: UncertaintyBudgetView = {
  id: 'b1',
  unitId: 'unit-1',
  boundary: 'reactor_outlet',
  uom: 't',
  components: [
    { kind: 'meter', label: 'FT-101', standardUncertainty: '3', sensitivity: '1' },
    { kind: 'scale', label: 'Packing scale', standardUncertainty: '3', sensitivity: '-1' },
  ],
  correlations: [],
  coverageFactor: '2',
  combinedStandardUncertainty: '4.24264069',
  expandedUncertainty: '8.48528137',
  contributions: [
    { index: 0, kind: 'meter', label: 'FT-101', contribution: '3', shareOfVariance: '0.5' },
    { index: 1, kind: 'scale', label: 'Packing scale', contribution: '3', shareOfVariance: '0.5' },
  ],
  covarianceTerm: '0',
  calibrationRef: 'CAL-FT101-2027-01',
  reviewDueAt: '2028-01-01T00:00:00.000Z',
  reviewOverdue: false,
  evidenceRef: null,
  notes: null,
  effectiveFrom: '2027-01-01T00:00:00.000Z',
  effectiveTo: null,
  inForce: false,
  state: 'proposed',
  authorId: 'author-1',
  decidedBy: null,
  decidedAt: null,
  decisionReason: null,
  createdAt: '2027-01-01T00:00:00.000Z',
  rowVersion: 1,
};

describe('measurement uncertainty screen (SME E4)', () => {
  let calls: Call[];

  const renderPage = () =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <MemoryRouter>
          <UncertaintyPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    calls = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        const call = { method: init.method ?? 'GET', url: new URL(url), body: init.body ? JSON.parse(String(init.body)) : null };
        calls.push(call);
        if (call.method === 'POST') return json(200, { ...PROPOSED, state: 'approved', inForce: true });
        if (call.url.pathname.endsWith('/units')) return json(200, { items: [{ id: 'unit-1', name: 'HDPE line 1' }], nextCursor: null });
        return json(200, { items: [PROPOSED], nextCursor: null });
      }),
    );
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin', 'user-1');
  });

  it("shows the server's combined and expanded uncertainty; a reader gets no write controls", async () => {
    actAs('viewer', 'viewer-1');
    renderPage();
    const card = await screen.findByTestId('budget-card');
    expect(card.getAttribute('data-state')).toBe('proposed');
    expect(screen.getByTestId('budget-combined').textContent).toContain('4.243');
    expect(screen.getByTestId('budget-expanded').textContent).toContain('8.485');
    expect(screen.queryByTestId('budget-approve')).toBeNull();
    expect(screen.queryByTestId('budget-new')).toBeNull();
    expect(calls.find((c) => c.url.pathname.endsWith('/uncertainty-budgets'))?.url.searchParams.get('unitId')).toBe('unit-1');
  });

  it('has no intro paragraph or timezone suffix; the definitions sit behind an info button', async () => {
    renderPage();
    await screen.findByTestId('budget-card');
    expect(screen.queryByText(/Uncertainty budget per measurement boundary/)).toBeNull();
    expect(screen.queryByText(/Unaccounted figures are always published/)).toBeNull();
    expect(screen.queryByText(/Asia\/Tehran/)).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Uncertainty budgets' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About Uncertainty budgets' })).toBeInTheDocument();
  });

  it('shows a clear empty state when the unit has no budget', async () => {
    const base = fetch as unknown as (url: string, init: RequestInit) => Promise<Response>;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => (new URL(url).pathname.endsWith('/uncertainty-budgets') ? json(200, { items: [], nextCursor: null }) : base(url, init))));
    renderPage();
    expect(await screen.findByText('No uncertainty budget for this unit')).toBeInTheDocument();
    expect(screen.queryByTestId('budget-card')).toBeNull();
  });

  it('production accounting cannot approve a budget: the metrology owner decides', async () => {
    actAs('production_accountant', 'accountant-1');
    renderPage();
    await screen.findByTestId('budget-card');
    expect(screen.queryByTestId('budget-approve')).toBeNull();
  });

  it('the metrology / instrumentation owner approves a budget it did not write', async () => {
    actAs('metrology_approver', 'checker-1');
    renderPage();
    fireEvent.click(await screen.findByTestId('budget-approve'));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')?.url.pathname).toMatch(/\/v2\/uncertainty-budgets\/b1\/approve$/);
  });

  it('a new budget is checked before anything is sent', async () => {
    actAs('production_engineer', 'engineer-1');
    renderPage();
    fireEvent.click(await screen.findByTestId('budget-new'));
    fireEvent.click(screen.getByTestId('budget-save'));
    expect(await screen.findByText('Enter the calibration evidence')).toBeTruthy();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });
});
