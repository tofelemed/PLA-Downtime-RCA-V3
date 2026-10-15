import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { V2RequestOptions } from '../client';
import { useMicroStopPolicy, useRecordTransitionAllowance, useTransitionAllowance } from './reliability-policies';
import { useImportStandbyRecords, useRetireStandby, useStandbyMetrics } from './reliability-standby';
import { useUnitStateCoverage, useUnitStateSignals } from './reliability-unit-state';
import { useImportWorkOrderOperations, useRepairEvidence, useWorkOrderOperationsPage } from './reliability-work-orders';

const server = vi.hoisted(() => ({ calls: [] as V2RequestOptions[] }));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ session: { user: { id: 'u1' }, tenant: { id: 'tenant-a' } } }) }));
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('../client', () => ({
  v2Request: vi.fn(async (request: V2RequestOptions) => {
    server.calls.push(request);
    const isList = request.method === 'GET' && !String(request.path).includes('current') && !String(request.path).includes('evidence') && !String(request.path).includes('metrics');
    return { status: 200, data: isList ? { items: [], nextCursor: null, asOf: 'now', scope: { tenantId: 'tenant-a' } } : { version: 3 } };
  }),
}));

const WINDOW = { from: '2026-10-01T00:00:00.000Z', to: '2026-10-08T00:00:00.000Z' };

describe('reliability v2 hooks (Area 2 screens)', () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const lastCall = () => server.calls[server.calls.length - 1];
  // a command's success refetches the reads it invalidated: the POST is not always the last call
  const lastPost = () => server.calls.filter((c) => c.method === 'POST').at(-1);

  beforeEach(() => {
    server.calls = [];
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  });

  it('reads the policy in force for the plant (no unitId) or for a unit', async () => {
    renderHook(() => [useMicroStopPolicy(''), useTransitionAllowance('u1')], { wrapper });
    await waitFor(() => expect(server.calls).toHaveLength(2));
    expect(server.calls.map((c) => [c.path, c.query])).toEqual([
      ['/micro-stop-policies/current', { unitId: undefined }],
      ['/transition-allowance-policies/current', { unitId: 'u1' }],
    ]);
  });

  it('records a transition-allowance version as a POST with an idempotency key', async () => {
    const { result } = renderHook(() => useRecordTransitionAllowance(), { wrapper });
    await act(() => result.current.submit({ unitId: 'u1', transitionAllowanceInPlan: 'loss' }));
    expect(lastPost()).toMatchObject({ method: 'POST', path: '/transition-allowance-policies', body: { unitId: 'u1', transitionAllowanceInPlan: 'loss' } });
    expect(lastPost()?.idempotencyKey).toEqual(expect.any(String));
  });

  it('standby: metrics over the window, retire by id, the log import wrapped in `records`', async () => {
    renderHook(() => useStandbyMetrics(WINDOW), { wrapper });
    await waitFor(() => expect(server.calls).toHaveLength(1));
    expect(server.calls[0]).toMatchObject({ path: '/standby-equipment/metrics', query: WINDOW });
    const retire = renderHook(() => useRetireStandby(), { wrapper }).result;
    await act(() => retire.current.submit('s1'));
    expect(lastPost()).toMatchObject({ method: 'POST', path: '/standby-equipment/s1/retire', body: {} });
    const importer = renderHook(() => useImportStandbyRecords(), { wrapper }).result;
    const row = { assetCode: 'P-1B', kind: 'demand' as const, startedAt: WINDOW.from, outcome: 'success' as const };
    await act(() => importer.current.submit([row]));
    expect(lastPost()).toMatchObject({ path: '/standby-records/import', body: { records: [row] } });
  });

  it('work orders: filters per stop or asset, repair evidence only with a stop, import wrapped in `operations`', async () => {
    renderHook(() => [useWorkOrderOperationsPage({ eventId: 'e1' }), useRepairEvidence(null), useRepairEvidence('e1')], { wrapper });
    await waitFor(() => expect(server.calls).toHaveLength(2));
    expect(server.calls.find((c) => c.path === '/work-order-operations')?.query).toMatchObject({ eventIds: ['e1'], assetIds: undefined });
    expect(server.calls.find((c) => c.path === '/work-order-operations/repair-evidence')?.query).toEqual({ eventId: 'e1' });
    const importer = renderHook(() => useImportWorkOrderOperations(), { wrapper }).result;
    const row = { workOrderId: 'W1', operationId: '10', kind: 'repair' as const, startedAt: WINDOW.from, assetCode: 'P-1' };
    await act(() => importer.current.submit([row]));
    expect(lastPost()).toMatchObject({ path: '/work-order-operations/import', body: { operations: [row] } });
  });

  it('unit state: coverage waits for a window; state signals of the unit only', async () => {
    renderHook(() => [useUnitStateCoverage(null), useUnitStateSignals('u1')], { wrapper });
    await waitFor(() => expect(server.calls).toHaveLength(1));
    expect(server.calls[0]).toMatchObject({ path: '/signals', query: { unitId: 'u1', semanticType: 'state', limit: 200 } });
    renderHook(() => useUnitStateCoverage({ unitId: 'u1', ...WINDOW }), { wrapper });
    await waitFor(() => expect(lastCall()).toMatchObject({ path: '/unit-state-mappings/coverage', query: { unitId: 'u1', ...WINDOW } }));
  });
});
