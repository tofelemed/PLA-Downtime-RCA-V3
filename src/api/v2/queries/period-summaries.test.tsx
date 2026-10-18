import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { V2RequestOptions } from '../client';
import { FILL_FETCH_BUDGET, shouldFetchMore, usePeriodSummaryList } from './period-summaries';

const auth = vi.hoisted(() => ({ session: { user: { id: 'u1' }, tenant: { id: 'tenant-a' } } }));
/** server pages by cursor: each holds that many rows; the last has no cursor */
const server = vi.hoisted(() => ({ sizes: [] as number[], calls: [] as Array<Record<string, unknown>> }));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('../client', () => ({
  v2Request: vi.fn(async (request: V2RequestOptions) => {
    const query = (request.query ?? {}) as { cursor?: string };
    server.calls.push({ ...query });
    const index = Number(query.cursor ?? 0);
    const items = Array.from({ length: server.sizes[index] ?? 0 }, (_, row) => ({ periodId: `p${index}-${row}` }));
    return { status: 200, data: { items, nextCursor: index + 1 < server.sizes.length ? String(index + 1) : null } };
  }),
}));

const QUERY = { unitIds: ['u1'], from: '2026-10-01T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z', residualStates: ['unaccounted' as const] };

describe('period summaries list that fills short filtered pages (U3 residualStates)', () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    server.calls = [];
  });

  it('decides to fetch on a short page while the cursor is set, within the budget, and always while nothing is shown', () => {
    const base = { rows: 3, target: 20, hasNextPage: true, busy: false, fetchedThisFill: 0 };
    expect(shouldFetchMore(base)).toBe(true);
    expect(shouldFetchMore({ ...base, hasNextPage: false })).toBe(false);
    expect(shouldFetchMore({ ...base, rows: 20 })).toBe(false);
    expect(shouldFetchMore({ ...base, busy: true })).toBe(false);
    expect(shouldFetchMore({ ...base, fetchedThisFill: FILL_FETCH_BUDGET })).toBe(false);
    expect(shouldFetchMore({ ...base, rows: 0, fetchedThisFill: FILL_FETCH_BUDGET + 3 })).toBe(true);
  });

  it('keeps paging past short and empty pages until the cursor is null; the count shows only then', async () => {
    server.sizes = [0, 3, 2];
    const { result } = renderHook(() => usePeriodSummaryList(QUERY, 'test'), { wrapper });
    await waitFor(() => expect(result.current.rows).toHaveLength(5));
    expect(server.calls).toHaveLength(3);
    expect(server.calls[0]).toMatchObject({ limit: 20, residualStates: ['unaccounted'] });
    expect(result.current.pager).toMatchObject({ mode: 'append', hasMore: false, totalCount: 5 });
    expect(result.current.status.isLoading).toBe(false);
  });

  it('stops at the target and offers "Show more", which fills the next step', async () => {
    server.sizes = [20, 20, 5];
    const { result } = renderHook(() => usePeriodSummaryList(QUERY, 'test'), { wrapper });
    await waitFor(() => expect(result.current.rows).toHaveLength(20));
    expect(result.current.pager).toMatchObject({ hasMore: true, totalCount: null });
    act(() => result.current.pager.loadMore?.());
    await waitFor(() => expect(result.current.rows).toHaveLength(40));
    expect(server.calls).toHaveLength(2);
  });
});
