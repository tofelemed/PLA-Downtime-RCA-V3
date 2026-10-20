import { afterEach, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { configureV2Session } from '../config';
import { useUnreadNotificationCount } from './notifications';

const plant = vi.hoisted(() => ({ loading: true, selection: null as { tenant: { id: string } } | null }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ session: { tenant: { id: 'home-plant' } } }) }));
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => plant }));

afterEach(() => vi.unstubAllGlobals());

it('waits for the saved acting plant before requesting the notification badge on reload', async () => {
  const requestedPlants: (string | null)[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    requestedPlants.push(new Headers(init.headers).get('X-Tenant-Id'));
    return new Response(JSON.stringify({ unread: 2 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
  configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => plant.selection?.tenant.id ?? null,
    refresh: async () => false, onSessionExpired: () => undefined });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const view = renderHook(() => useUnreadNotificationCount(), { wrapper });
  expect(view.result.current.fetchStatus).toBe('idle');
  expect(requestedPlants).toEqual([]);
  plant.selection = { tenant: { id: 'selected-plant' } };
  plant.loading = false;
  view.rerender();
  await waitFor(() => expect(view.result.current.data?.unread).toBe(2));
  // every request (the shell bootstrap batch, then the badge's own endpoint here) names the selected plant
  expect(requestedPlants.length).toBeGreaterThan(0);
  expect(requestedPlants.every((tenantId) => tenantId === 'selected-plant')).toBe(true);
  view.unmount();
  client.clear();
});
