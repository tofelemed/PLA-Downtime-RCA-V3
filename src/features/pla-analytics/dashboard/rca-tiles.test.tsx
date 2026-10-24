import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import { TooltipProvider } from '@/components/ui/tooltip';

const caps = vi.hoisted(() => ({ canViewOperations: true, canViewAnalysis: true }));
vi.mock('@/features/auth/use-capabilities', () => ({ useCapabilities: () => caps }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ session: { tenant: { id: 'tenant-a' } } }) }));
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { RcaTiles } = await import('./rca-tiles');

function renderTiles() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TooltipProvider>
          <RcaTiles />
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Dashboard RCA tiles', () => {
  let paths: string[];
  beforeEach(() => {
    paths = [];
    caps.canViewOperations = true;
    caps.canViewAnalysis = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        paths.push(new URL(url).pathname);
        const body = { total: 9, open: 4, overdue: 1, critical: 0, overdueActions: 3, effectivenessPending: 2, byStatus: [], asOf: '2026-10-15T00:00:00.000Z' };
        return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }),
    );
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows the server counts of open cases, overdue actions and pending effectiveness checks', async () => {
    renderTiles();
    await waitFor(() => expect(screen.getByTestId('dashboard-rca-open')).toHaveAttribute('data-count', '4'));
    expect(screen.getByTestId('dashboard-rca-overdueActions')).toHaveAttribute('data-count', '3');
    expect(screen.getByTestId('dashboard-rca-effectivenessPending')).toHaveAttribute('data-count', '2');
    expect(paths).toEqual([expect.stringMatching(/\/v2\/rcas\/summary$/)]);
  });

  it('titles the five tiles', async () => {
    renderTiles();
    await waitFor(() => expect(screen.getByTestId('dashboard-rca-open')).toBeInTheDocument());
    for (const title of ['Open investigations', 'Overdue investigations', 'Open critical', 'Overdue actions', 'Effectiveness pending']) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
  });

  it('counts open the filtered investigation or action list (UX audit G-6); effectiveness is plain', async () => {
    renderTiles();
    await waitFor(() => expect(screen.getByTestId('dashboard-rca-overdue')).toHaveAttribute('data-count', '1'));
    expect(screen.getByRole('link', { name: 'Overdue investigations: 1, open the list' })).toHaveAttribute('href', '/rca?due=overdue');
    expect(screen.getByRole('link', { name: 'Open critical: 0, open the list' })).toHaveAttribute('href', '/rca?open=true&priority=Critical');
    expect(screen.getByRole('link', { name: 'Overdue actions: 3, open the list' })).toHaveAttribute('href', '/rca?tab=actions&mine=false&overdue=true');
    expect(screen.queryByRole('link', { name: /Effectiveness pending/ })).toBeNull();
  });

  it('links Investigations to operators and Cause portfolio only with analysis access', async () => {
    caps.canViewAnalysis = false;
    renderTiles();
    await waitFor(() => expect(screen.getByTestId('dashboard-rca-open')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Investigations' })).toHaveAttribute('href', '/rca');
    expect(screen.queryByRole('link', { name: 'Cause portfolio' })).toBeNull();
  });

  it('links Cause portfolio with analysis access', async () => {
    renderTiles();
    await waitFor(() => expect(screen.getByTestId('dashboard-rca-open')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Cause portfolio' })).toHaveAttribute('href', '/reliability/portfolio');
  });
});
