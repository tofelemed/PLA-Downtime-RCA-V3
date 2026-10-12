import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { configureV2Session } from '@/api/v2/config';
import { v2Keys } from '@/api/v2/queries/query-keys';
import { httpClient } from '@/services/api/httpClient';
import { useAssetNames } from './use-asset-names';
import { useProductNames } from './use-product-names';
import { useUnitNames } from './use-unit-names';
import { useUserNames } from './use-user-names';

const auth = vi.hoisted(() => ({ session: { user: { id: 'u1' }, tenant: { id: 'tenant-a' } } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const UNIT_ID = '3f2a9c1b-1234-4abc-8def-0123456789ab';
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const page = (items: unknown[]) => ({ items, nextCursor: null });

describe('display-name resolvers', () => {
  let client: QueryClient;
  let fetchMock: ReturnType<typeof vi.fn>;
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
    httpClient.setTokenProvider(() => 'a.b.c');
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('useUnitNames resolves from the shared v2 unit list and never returns the id', async () => {
    fetchMock.mockImplementation(async () => json(200, page([{ id: UNIT_ID, code: 'U100', name: 'Extruder 1', siteId: null }])));
    const { result } = renderHook(() => useUnitNames(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.nameOf(UNIT_ID)).toBe('Extruder 1');
    expect(result.current.nameOf('other')).toBe('Unknown unit');
    expect(result.current.nameOf(null)).toBe('—');
    expect(client.getQueryData(v2Keys.list('tenant-a', 'units', {}))).toBeDefined();
  });

  it('useProductNames falls back to "Unknown product"', async () => {
    fetchMock.mockImplementation(async () => json(200, page([{ id: 'p1', code: 'HD', name: 'HDPE film', uom: 't', isActive: true }])));
    const { result } = renderHook(() => useProductNames(), { wrapper });
    await waitFor(() => expect(result.current.nameOf('p1')).toBe('HDPE film'));
    expect(result.current.nameOf('p2')).toBe('Unknown product');
  });

  it('useAssetNames reads the v1 asset list once per tenant', async () => {
    fetchMock.mockImplementation(async () => json(200, [{ id: 'a1', code: 'P-3', name: 'Pump 3' }]));
    const { result } = renderHook(() => useAssetNames(), { wrapper });
    await waitFor(() => expect(result.current.nameOf('a1')).toBe('Pump 3'));
    expect(result.current.nameOf('a2')).toBe('Unknown asset');
    expect(client.getQueryData(['v1', 'tenant-a', 'assets'])).toBeDefined();
  });

  it('useUserNames resolves plant members from the v2 directory, asks for inactive ones by id, and degrades silently', async () => {
    const INACTIVE = 'd9800d1c-0000-4000-8000-000000000000';
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('ids=')
        ? json(200, page([{ id: INACTIVE, name: 'Former Lead', isActive: false }]))
        : json(200, page([{ id: 'u2', name: 'Sara Ahmadi', isActive: true }])),
    );
    const { result } = renderHook(() => useUserNames(['u2', INACTIVE]), { wrapper });
    await waitFor(() => expect(result.current.nameOf(INACTIVE)).toBe('Former Lead'));
    expect(result.current.nameOf('u2')).toBe('Sara Ahmadi');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/v2/users/directory');

    client = new QueryClient({ defaultOptions: { queries: { retry: 3 } } });
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => json(403, { code: 'FORBIDDEN', message: 'Forbidden', correlationId: 'c', retryable: false }));
    const refused = renderHook(() => useUserNames(), { wrapper });
    await waitFor(() => expect(refused.result.current.isLoading).toBe(false));
    expect(refused.result.current.nameOf('u2')).toBe('Unknown user');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
