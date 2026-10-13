import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { V2RequestOptions } from '../client';
import { useAssetDirectory } from './assets';

const auth = vi.hoisted(() => ({ session: { user: { id: 'u1' }, tenant: { id: 'tenant-a' } } }));
const server = vi.hoisted(() => ({ calls: [] as V2RequestOptions[], total: 1200 }));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('../client', () => ({
  v2Request: vi.fn(async (request: V2RequestOptions) => {
    server.calls.push(request);
    const query = (request.query ?? {}) as { limit?: number; cursor?: string };
    const offset = Number(query.cursor ?? 0);
    const end = Math.min(server.total, offset + Number(query.limit));
    const items = Array.from({ length: end - offset }, (_, i) => ({ id: `a${offset + i}`, code: `A${offset + i}`, name: `Asset ${offset + i}`, unitId: 'u1', retiredAt: null }));
    return { status: 200, data: { items, nextCursor: end < server.total ? String(end) : null, asOf: 'now', scope: { tenantId: 'tenant-a' } } };
  }),
}));

describe('useAssetDirectory (FE-09: assets from GET /v2/assets)', () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

  beforeEach(() => {
    server.calls = [];
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('reads every keyset page of the plant (500 each, retired included, by name) and shares one cache', async () => {
    const { result } = renderHook(() => [useAssetDirectory(), useAssetDirectory()] as const, { wrapper });
    await waitFor(() => expect(result.current[0].assets).toHaveLength(1200));
    expect(result.current[0].isLoading).toBe(false);
    expect(server.calls).toHaveLength(3);
    expect(server.calls.every((call) => call.path === '/assets')).toBe(true);
    expect(server.calls[0].query).toMatchObject({ limit: 500, status: 'all', sort: 'name' });
    expect(result.current[1].assets).toEqual(result.current[0].assets);
  });
});
