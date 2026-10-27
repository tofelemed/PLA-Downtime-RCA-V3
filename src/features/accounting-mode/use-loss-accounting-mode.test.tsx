import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { V2RequestOptions } from '@/api/v2/client';
import { useLossAccountingMode } from './use-loss-accounting-mode';

const auth = vi.hoisted(() => ({ session: { user: { id: 'u1' }, tenant: { id: 'tenant-a' } } }));
const server = vi.hoisted(() => ({ fail: false, policy: {} as Record<string, unknown>, calls: [] as Array<Record<string, unknown>> }));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null, loading: false }) }));
vi.mock('@/api/v2/client', () => ({
  v2Request: vi.fn(async (request: V2RequestOptions) => {
    server.calls.push({ path: request.path, ...(request.query ?? {}) });
    if (server.fail) throw new Error('boom');
    return { status: 200, data: { policyId: 'p1', version: 2, unitId: null, effectiveFrom: '2026-10-01T00:00:00.000Z', notes: null, policy: server.policy } };
  }),
}));

const policy = (over: Record<string, unknown>) => ({
  grain: 'shift', dayStart: '06:00', lossBasis: 'computed', targetSource: 'plan', accountingUnitId: null, stopsCrossCheck: true, identityTolerance: 0, ...over,
});

describe('useLossAccountingMode', () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    server.fail = false;
    server.calls = [];
  });

  it('reports declared and day from the policy in force', async () => {
    server.policy = policy({ grain: 'day', lossBasis: 'declared', targetSource: 'declared', accountingUnitId: 'u-1' });
    const { result } = renderHook(() => useLossAccountingMode('u-1'), { wrapper });
    await waitFor(() => expect(result.current.isDeclared).toBe(true));
    expect(result.current).toMatchObject({ grain: 'day', lossBasis: 'declared', targetSource: 'declared', accountingUnitId: 'u-1', isDay: true, isLoading: false });
    expect(server.calls[0]).toMatchObject({ path: '/loss-accounting', unitId: 'u-1' });
  });

  it('a declared daily policy kept on another unit reads computed per shift for this unit', async () => {
    server.policy = policy({ grain: 'day', lossBasis: 'declared', targetSource: 'declared', accountingUnitId: 'u-9' });
    const { result } = renderHook(() => useLossAccountingMode('u-1'), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toMatchObject({ grain: 'shift', lossBasis: 'computed', targetSource: 'plan', accountingUnitId: 'u-9', isDeclared: false, isDay: false });
  });

  it('keeps the computed per-shift flags for the default policy', async () => {
    server.policy = policy({});
    const { result } = renderHook(() => useLossAccountingMode(), { wrapper });
    await waitFor(() => expect(server.calls.length).toBe(1));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toMatchObject({ isDeclared: false, isDay: false });
  });

  it('falls back to the computed / shift defaults when the read fails', async () => {
    server.fail = true;
    const { result } = renderHook(() => useLossAccountingMode('u-1'), { wrapper });
    await waitFor(() => expect(server.calls.length).toBe(1));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toEqual({ grain: 'shift', lossBasis: 'computed', targetSource: 'plan', accountingUnitId: null, isDeclared: false, isDay: false, isLoading: false });
  });
});
