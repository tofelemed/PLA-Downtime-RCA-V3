import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { V2RequestOptions } from '@/api/v2/client';
import type { QueryParams } from '@/api/v2/request-url';
import { usePagedQuery } from '@/api/v2/queries/use-paged-query';
import { defaultFilters, toEventQuery, type EventSort } from './event-filters';

const auth = vi.hoisted(() => ({ session: { user: { id: 'u1' }, tenant: { id: 'tenant-a' } } }));
const server = vi.hoisted(() => ({ calls: [] as Array<Record<string, unknown>> }));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/api/v2/client', () => ({
  v2Request: vi.fn(async (request: V2RequestOptions) => {
    const query = (request.query ?? {}) as { limit?: number; cursor?: string };
    server.calls.push({ ...query });
    const offset = Number(query.cursor ?? 0);
    const items = Array.from({ length: Number(query.limit) }, (_, index) => ({ id: `e${offset + index}` }));
    return { status: 200, data: { items, nextCursor: String(offset + items.length), asOf: 'now', scope: { tenantId: 'tenant-a' } } };
  }),
}));

const WINDOW = { from: '2026-10-15T00:00:00.000Z', to: '2026-10-16T00:00:00.000Z', label: 'Custom window' };

function useEventPages(sort: EventSort) {
  const query = toEventQuery({ ...defaultFilters(WINDOW), sort });
  const { from, to, ...rest } = query;
  return usePagedQuery<{ id: string }>({
    resource: 'production-events',
    path: '/production-events',
    query: query as QueryParams,
    key: { window: { from, to }, filters: rest },
  });
}

describe('E-1: a new sort restarts the keyset pages', () => {
  it('returns to page 1 and requests the first page in the new order without the old cursor', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result, rerender } = renderHook(({ sort }: { sort: EventSort }) => useEventPages(sort), { wrapper, initialProps: { sort: 'newest' } });
    await waitFor(() => expect(result.current.rows).toHaveLength(20));
    act(() => result.current.pager.next());
    await waitFor(() => expect(result.current.pager.pageIndex).toBe(1));
    rerender({ sort: 'longest' });
    expect(result.current.pager.pageIndex).toBe(0);
    await waitFor(() => expect(server.calls.at(-1)).toMatchObject({ sort: '-durationSeconds' }));
    expect(server.calls.at(-1)?.cursor).toBeUndefined();
  });
});
