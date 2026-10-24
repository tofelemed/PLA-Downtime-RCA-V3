import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { RcaListPage } = await import('./rca-list-page');

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const list = { items: [], nextCursor: null, asOf: '2026-10-19T00:00:00Z', scope: { tenantId: 'tenant-a' } };
const SUMMARY = { total: 3, open: 2, overdue: 1, critical: 0, overdueActions: 0, effectivenessPending: 0, byStatus: [{ status: 'Closed', count: 1 }], asOf: '2026-10-19T00:00:00Z' };

const renderAt = (entry: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[entry]}>
        <RcaListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('/rca cleanup (owner direction 24 Oct 2026)', () => {
  beforeEach(() => {
    actAs('SuperAdmin', 'u-1');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => json(new URL(url).pathname.endsWith('/rcas/summary') ? SUMMARY : list)));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('Investigations: no header description; counts, New investigation, labelled h-9 filters and the card with its ⓘ stay', async () => {
    renderAt('/rca');
    expect(await screen.findByText('All investigations: 3')).toBeInTheDocument();
    expect(screen.queryByText(/Investigations of this plant/)).toBeNull();
    expect(screen.queryByText(/Triggers only recommend/)).toBeNull();
    expect(screen.getByTestId('new-case')).toHaveTextContent('New investigation');
    const bar = screen.getByTestId('case-filters');
    expect(bar.className).toContain('items-end');
    for (const label of ['Status', 'Priority', 'Target date', 'Open / closed']) expect(within(bar).getByLabelText(label).className).toContain('h-9');
    expect(within(bar).getByText('Search')).toBeInTheDocument();
    expect(bar.querySelector('input')?.closest('div.relative')?.className).toContain('[&_input]:h-9');
    const card = screen.getByRole('region', { name: 'Investigations' });
    expect(card.className).toContain('bg-card');
    expect(within(card).getByRole('button', { name: 'About Investigations' })).toBeInTheDocument();
  });

  it('Investigations: an empty list keeps its own message and the Clear filters action (not "No data for these dates")', async () => {
    renderAt('/rca');
    expect(await screen.findByText('No investigation matches these filters.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
    expect(screen.queryByText('No data for these dates')).toBeNull();
    expect(screen.queryByText(/Open one from an event in the Event Hub/)).toBeNull();
  });

  it('Actions: no description; unit first, labelled h-9 controls; own empty message with Reset filters', async () => {
    renderAt('/rca?tab=actions&mine=true');
    expect(await screen.findByText('You own no action that matches these filters.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset filters' })).toBeInTheDocument();
    expect(screen.queryByText(/earliest due date first/)).toBeNull();
    const card = screen.getByRole('region', { name: 'Actions' });
    expect(within(card).getByRole('button', { name: 'About Actions' })).toBeInTheDocument();
    const bar = screen.getByTestId('action-filters');
    expect(bar.className).toContain('items-end');
    expect(within(bar).getByLabelText('Unit').className).toContain('h-9');
    expect(within(bar).getByLabelText('Status').className).toContain('h-9');
    expect(within(bar).getAllByRole('combobox')[0]).toBe(within(bar).getByLabelText('Unit'));
    expect(within(bar).getByLabelText('Mine')).toBeInTheDocument();
    expect(within(bar).getByLabelText('Overdue')).toBeInTheDocument();
  });

  it('Recommended: no description; labelled h-9 unit filter; own empty message', async () => {
    renderAt('/rca?tab=recommended');
    expect(await screen.findByText('No RCA trigger has fired on an event without an investigation.')).toBeInTheDocument();
    expect(screen.queryByText(/Stops where an RCA trigger fired/)).toBeNull();
    const card = screen.getByRole('region', { name: 'Recommended investigations' });
    expect(within(card).getByRole('button', { name: 'About Recommended investigations' })).toBeInTheDocument();
    expect(screen.getByLabelText('Unit').className).toContain('h-9');
  });
});
