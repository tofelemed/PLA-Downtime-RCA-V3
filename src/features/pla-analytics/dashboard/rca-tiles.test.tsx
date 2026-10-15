import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ session: { tenant: { id: 'tenant-a' } } }) }));
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { RcaTiles } = await import('./rca-tiles');

describe('Dashboard RCA tiles', () => {
  let paths: string[];
  beforeEach(() => {
    paths = [];
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
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <RcaTiles />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('dashboard-rca-open')).toHaveAttribute('data-count', '4'));
    expect(screen.getByTestId('dashboard-rca-overdueActions')).toHaveAttribute('data-count', '3');
    expect(screen.getByTestId('dashboard-rca-effectivenessPending')).toHaveAttribute('data-count', '2');
    expect(paths).toEqual([expect.stringMatching(/\/v2\/rcas\/summary$/)]);
  });
});
