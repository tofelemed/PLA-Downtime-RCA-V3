import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { V2RequestOptions } from '../client';
import { useDecideLossAccountingVersion, useDraftLossAccountingVersion, useLossAccountingInForce, useLossAccountingVersions } from './loss-accounting';

const auth = vi.hoisted(() => ({ session: { user: { id: 'u1' }, tenant: { id: 'tenant-a' } } }));
const requests = vi.hoisted(() => ({ calls: [] as Array<Record<string, unknown>> }));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null, loading: false }) }));
vi.mock('../client', () => ({
  v2Request: vi.fn(async (request: V2RequestOptions) => {
    requests.calls.push({ method: request.method, path: request.path, query: request.query, body: request.body });
    return { status: 200, data: { items: [], nextCursor: null } };
  }),
}));

describe('loss accounting queries', () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    requests.calls = [];
  });

  it('keys the in-force read by tenant and unit, and sends the unit as a query', async () => {
    renderHook(() => useLossAccountingInForce('u-1'), { wrapper });
    renderHook(() => useLossAccountingInForce(), { wrapper });
    await waitFor(() => expect(requests.calls.length).toBe(2));
    const keys = client.getQueryCache().getAll().map((query) => query.queryKey);
    expect(keys).toContainEqual(['v2', 'tenant-a', 'loss-accounting', 'detail', 'in-force', 'u-1']);
    expect(keys).toContainEqual(['v2', 'tenant-a', 'loss-accounting', 'detail', 'in-force', 'plant']);
    expect(requests.calls).toContainEqual({ method: 'GET', path: '/loss-accounting', query: { unitId: 'u-1' }, body: undefined });
    expect(requests.calls).toContainEqual({ method: 'GET', path: '/loss-accounting', query: {}, body: undefined });
  });

  it('lists versions with the plant-wide ones for a unit', async () => {
    renderHook(() => useLossAccountingVersions('u-1'), { wrapper });
    await waitFor(() => expect(requests.calls.length).toBe(1));
    expect(requests.calls[0]).toMatchObject({ path: '/loss-accounting/versions', query: { unitId: 'u-1', includeTenantWide: true, limit: 100 } });
    expect(client.getQueryCache().getAll()[0].queryKey.slice(0, 4)).toEqual(['v2', 'tenant-a', 'loss-accounting', 'list']);
  });

  it('posts the draft body as given and decides by id', async () => {
    const draft = renderHook(() => useDraftLossAccountingVersion(), { wrapper });
    const body = { unitId: 'u-1', grain: 'day' as const, dayStart: '06:00', lossBasis: 'declared' as const, targetSource: 'declared' as const, accountingUnitId: null, stopsCrossCheck: true, identityTolerance: 0.001 };
    await draft.result.current.submit(body);
    const decide = renderHook(() => useDecideLossAccountingVersion(), { wrapper });
    await decide.result.current.submit({ id: 'v-7', decision: 'reject', reason: 'not yet' });
    expect(requests.calls[0]).toMatchObject({ method: 'POST', path: '/loss-accounting/versions', body });
    expect(requests.calls[1]).toMatchObject({ method: 'POST', path: '/loss-accounting/versions/v-7/reject', body: { reason: 'not yet' } });
  });
});
