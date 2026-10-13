import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { configureV2Session } from '@/api/v2/config';

const auth = vi.hoisted(() => ({ session: { user: { id: 'u1', role: 'SuperAdmin', tenantId: 'plant-a' }, tenant: { id: 'plant-a' } } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { usePlantDirectory, usePlantUnits, useUnitAssets } = await import('./use-plant-directory');

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const page = (items: unknown[], nextCursor: string | null = null) => ({ items, nextCursor, asOf: 'now', scope: {} });

describe('plant directory on v2 (V1 of the v2-only plan)', () => {
  let client: QueryClient;
  let calls: Array<{ url: URL; tenant: string | null }>;
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

  beforeEach(() => {
    calls = [];
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'plant-a', refresh: async () => false, onSessionExpired: () => undefined });
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      const parsed = new URL(url);
      calls.push({ url: parsed, tenant: new Headers(init.headers).get('X-Tenant-Id') });
      if (parsed.pathname.endsWith('/organizations')) return json(page([{ id: 'org-1', code: 'O', name: 'Org' }]));
      if (parsed.pathname.endsWith('/tenants')) {
        return parsed.searchParams.get('cursor')
          ? json(page([{ id: 'plant-b', code: 'B', name: 'Plant B', organizationId: 'org-1' }]))
          : json(page([{ id: 'plant-a', code: 'A', name: 'Plant A', organizationId: 'org-1' }], 'next'));
      }
      if (parsed.pathname.endsWith('/units')) return json(page([{ id: 'unit-1', code: 'K1', name: 'Kiln 1' }]));
      return json(page([{ id: 'asset-1', code: 'P1', name: 'Pump 1', unitId: 'unit-1' }]));
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lists organisations and every page of plants from /v2', async () => {
    const { result } = renderHook(() => usePlantDirectory(), { wrapper });
    await waitFor(() => expect(result.current.tenants).toHaveLength(2));
    expect(result.current.organizations.map((org) => org.id)).toEqual(['org-1']);
    expect(calls.every((call) => call.url.pathname.includes('/v2/'))).toBe(true);
  });

  it('reads units and active assets of a browsed plant as that plant (X-Tenant-Id), not the acting one', async () => {
    const units = renderHook(() => usePlantUnits('plant-b', true), { wrapper });
    await waitFor(() => expect(units.result.current.data).toHaveLength(1));
    const assets = renderHook(() => useUnitAssets('plant-b', { id: 'unit-1', code: 'K1', name: 'Kiln 1' }, true), { wrapper });
    await waitFor(() => expect(assets.result.current.data).toHaveLength(1));
    expect(calls.map((call) => call.tenant)).toEqual(['plant-b', 'plant-b']);
    expect(calls[1].url.searchParams.getAll('unitIds')).toEqual(['unit-1']);
    expect(calls[1].url.searchParams.get('status')).toBe('active');
  });
});
