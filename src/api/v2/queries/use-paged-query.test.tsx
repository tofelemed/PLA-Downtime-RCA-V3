import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { V2RequestOptions } from '../client';
import { usePagedQuery, type PagedQueryOptions } from './use-paged-query';

const auth = vi.hoisted(() => ({ session: { user: { id: 'u1' }, tenant: { id: 'tenant-a' } } }));
const server = vi.hoisted(() => ({ calls: [] as Array<Record<string, unknown>>, total: 45 }));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('../client', () => ({
  v2Request: vi.fn(async (request: V2RequestOptions) => {
    const query = (request.query ?? {}) as { limit?: number; cursor?: string; q?: string };
    server.calls.push({ ...query });
    const offset = Number(query.cursor ?? 0);
    const limit = Number(query.limit);
    const prefix = query.q ?? 'item';
    const end = Math.min(server.total, offset + limit);
    const items = Array.from({ length: Math.max(0, end - offset) }, (_, index) => ({ name: `${prefix} ${offset + index + 1}` }));
    return { status: 200, data: { items, nextCursor: end < server.total ? String(end) : null, asOf: 'now', scope: { tenantId: 'tenant-a' } } };
  }),
}));

interface Thing {
  name: string;
}

const optionsFor = (q: string, extra: Partial<PagedQueryOptions> = {}): PagedQueryOptions => ({
  resource: 'signals',
  path: '/things',
  query: { q },
  key: { filters: { q } },
  ...extra,
});

describe('usePagedQuery (keyset pages of 20)', () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    server.calls = [];
    server.total = 45;
  });

  it('loads 20 rows, fetches the next cursor on Next, reads the cache on Previous', async () => {
    const { result } = renderHook(() => usePagedQuery<Thing>(optionsFor('item')), { wrapper });
    await waitFor(() => expect(result.current.rows).toHaveLength(20));
    expect(server.calls[0]).toMatchObject({ limit: 20 });
    expect(result.current.pager).toMatchObject({ pageIndex: 0, canNext: true, pageCount: null, totalCount: null, rangeStart: 1, rangeEnd: 20 });
    act(() => result.current.pager.next());
    await waitFor(() => expect(result.current.pager.pageIndex).toBe(1));
    expect(result.current.rows[0].name).toBe('item 21');
    expect(result.current.pager).toMatchObject({ rangeStart: 21, rangeEnd: 40 });
    act(() => result.current.pager.next());
    await waitFor(() => expect(result.current.pager.pageIndex).toBe(2));
    expect(result.current.rows).toHaveLength(5);
    expect(result.current.pager).toMatchObject({ canNext: false, pageCount: 3, totalCount: 45, rangeStart: 41, rangeEnd: 45 });
    const callsBefore = server.calls.length;
    act(() => result.current.pager.previous());
    expect(result.current.pager.pageIndex).toBe(1);
    expect(result.current.rows[0].name).toBe('item 21');
    expect(server.calls).toHaveLength(callsBefore);
  });

  it('returns to page 1 when the filters change', async () => {
    const { result, rerender } = renderHook(({ q }: { q: string }) => usePagedQuery<Thing>(optionsFor(q)), { wrapper, initialProps: { q: 'item' } });
    await waitFor(() => expect(result.current.rows).toHaveLength(20));
    act(() => result.current.pager.next());
    await waitFor(() => expect(result.current.pager.pageIndex).toBe(1));
    rerender({ q: 'pump' });
    expect(result.current.pager.pageIndex).toBe(0);
    await waitFor(() => expect(result.current.rows[0]?.name).toBe('pump 1'));
  });

  it('a page size change refetches with the new limit and returns to page 1', async () => {
    const { result } = renderHook(() => usePagedQuery<Thing>(optionsFor('item')), { wrapper });
    await waitFor(() => expect(result.current.rows).toHaveLength(20));
    act(() => result.current.pager.next());
    await waitFor(() => expect(result.current.pager.pageIndex).toBe(1));
    act(() => result.current.pager.setPageSize(50));
    expect(result.current.pager.pageIndex).toBe(0);
    await waitFor(() => expect(result.current.rows).toHaveLength(45));
    expect(server.calls.at(-1)).toMatchObject({ limit: 50 });
    expect(result.current.pager).toMatchObject({ pageSize: 50, pageCount: 1, totalCount: 45, canNext: false });
  });

  it('append mode grows one list with loadMore', async () => {
    const { result } = renderHook(() => usePagedQuery<Thing>(optionsFor('item', { mode: 'append' })), { wrapper });
    await waitFor(() => expect(result.current.rows).toHaveLength(20));
    expect(result.current.pager).toMatchObject({ mode: 'append', hasMore: true, rangeEnd: 20 });
    act(() => result.current.pager.loadMore?.());
    await waitFor(() => expect(result.current.rows).toHaveLength(40));
    expect(result.current.rows[39].name).toBe('item 40');
    expect(result.current.pager.rangeEnd).toBe(40);
  });

  it('reports loading, then ready status', async () => {
    const { result } = renderHook(() => usePagedQuery<Thing>(optionsFor('item')), { wrapper });
    expect(result.current.status.isLoading).toBe(true);
    await waitFor(() => expect(result.current.status.isLoading).toBe(false));
    expect(result.current.status).toMatchObject({ isError: false, isRefreshing: false });
  });
});
