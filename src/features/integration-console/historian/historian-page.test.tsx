import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { HistorianPage } = await import('./historian-page');

const page = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/enhanced-historian']}>
        <HistorianPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('Enhanced Historian page gate (matches the menu: canViewAnalysis)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response(JSON.stringify({ items: [], nextCursor: null }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin');
  });

  it.each(['viewer', 'Analyst', 'production_engineer', 'reliability_engineer'])('opens for the reader role %s', async (role) => {
    actAs(role);
    page();
    expect(await screen.findByTestId('historian')).toBeTruthy();
    expect(screen.queryByText('No access')).toBeNull();
  });

  it('refuses an operator without asking the server for signals', () => {
    actAs('Operator');
    page();
    expect(screen.getByText('No access')).toBeTruthy();
    expect(screen.queryByTestId('historian')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
