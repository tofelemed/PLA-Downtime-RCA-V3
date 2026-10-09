import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { configureV2Session } from '../config';
import { invalidateForChange, windowsOverlap } from './invalidation';
import { v2Keys } from './query-keys';
import { useV2Command } from './use-v2-command';
import { reportKey, reportSnapshot } from './reports';
import type { AnalyticsResponse } from '../types/envelopes';
import type { DowntimeReportView } from '../types/reports';

const auth = vi.hoisted(() => ({
  session: { user: { id: 'u1' }, tenant: { id: 'tenant-a' } } as { user: { id: string }; tenant: { id: string } } | null,
  getAccessToken: () => 'header.payload.signature',
  refreshSession: vi.fn(async () => false),
  expireSession: vi.fn(),
}));
const plant = vi.hoisted(() => ({ selection: null as { tenant?: { id: string } } | null }));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => plant }));

const { V2SessionBridge } = await import('@/features/v2-foundation/v2-session-bridge');

const seed = (client: QueryClient, tenantId: string, resource: Parameters<typeof v2Keys.list>[1], window?: { from: string; to: string }) =>
  client.setQueryData(v2Keys.list(tenantId, resource, { window: window ?? null }), { items: [] });

describe('v2 cache rules (plan 3.1)', () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    auth.session = { user: { id: 'u1' }, tenant: { id: 'tenant-a' } };
    plant.selection = null;
  });
  afterEach(() => vi.unstubAllGlobals());

  it('a tenant switch clears every cached query', () => {
    const view = render(<V2SessionBridge />, { wrapper });
    seed(client, 'tenant-a', 'production-events');
    expect(client.getQueryCache().getAll()).toHaveLength(1);
    plant.selection = { tenant: { id: 'tenant-b' } };
    view.rerender(<V2SessionBridge />);
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });

  it('a session end (401 after a failed refresh) clears the cache', () => {
    const view = render(<V2SessionBridge />, { wrapper });
    seed(client, 'tenant-a', 'reports');
    auth.session = null;
    view.rerender(<V2SessionBridge />);
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });

  it('an event change invalidates events, overlapping periods and reports of its tenant only', async () => {
    seed(client, 'tenant-a', 'production-events');
    seed(client, 'tenant-a', 'production-periods', { from: '2026-10-09T00:00:00Z', to: '2026-10-10T00:00:00Z' });
    seed(client, 'tenant-a', 'production-periods', { from: '2026-10-01T00:00:00Z', to: '2026-10-02T00:00:00Z' });
    seed(client, 'tenant-a', 'reports');
    seed(client, 'tenant-a', 'codes');
    seed(client, 'tenant-b', 'production-events');
    await invalidateForChange(client, {
      tenantId: 'tenant-a',
      entityType: 'production_event',
      window: { from: '2026-10-09T06:00:00Z', to: '2026-10-09T07:00:00Z' },
    });
    const invalid = client
      .getQueryCache()
      .getAll()
      .filter((query) => query.state.isInvalidated)
      .map((query) => `${query.queryKey[1]}/${query.queryKey[2]}/${JSON.stringify(query.queryKey[5])}`);
    expect(invalid.sort()).toEqual(
      [
        'tenant-a/production-events/null',
        'tenant-a/production-periods/{"from":"2026-10-09T00:00:00Z","to":"2026-10-10T00:00:00Z"}',
        'tenant-a/reports/null',
      ].sort(),
    );
  });

  it('windows overlap half-open; open bounds always overlap', () => {
    expect(windowsOverlap({ from: '2026-10-09T00:00:00Z', to: '2026-10-09T06:00:00Z' }, { from: '2026-10-09T06:00:00Z', to: null })).toBe(false);
    expect(windowsOverlap({ from: '2026-10-09T00:00:00Z' }, { from: '2026-10-08T00:00:00Z', to: null })).toBe(true);
    expect(windowsOverlap(null, { from: 'x', to: null })).toBe(true);
  });

  it('a command keeps its Idempotency-Key across retries; a new submit gets a new key', async () => {
    const keys: string[] = [];
    const statuses = [503, 200, 200];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        keys.push(new Headers(init.headers).get('Idempotency-Key') ?? '');
        const status = statuses.shift() ?? 200;
        return new Response(JSON.stringify(status === 200 ? { id: 'e1' } : { code: 'UNAVAILABLE', message: 'x', correlationId: null, retryable: true }), {
          status,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
    configureV2Session({ getAccessToken: () => 't.t.t', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
    const { v2Request } = await import('../client');
    const { result } = renderHook(
      () =>
        useV2Command<{ n: number }, unknown>({
          run: ({ idempotencyKey }) => v2Request({ method: 'POST', path: '/x', body: {}, idempotencyKey }).then((r) => r.data),
          changes: () => null,
          retries: 2,
        }),
      { wrapper },
    );
    await act(async () => {
      await result.current.submit({ n: 1 });
    });
    await act(async () => {
      await result.current.submit({ n: 2 });
    });
    await waitFor(() => expect(keys).toHaveLength(3));
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  it('T24: chart, totals and export of a report share one snapshot (run ids and filters)', () => {
    const filters = { from: '2026-10-01T00:00:00Z', to: '2026-10-08T00:00:00Z', unitIds: ['u2', 'u1'], approvedOnly: true };
    const response: AnalyticsResponse<DowntimeReportView> = {
      data: {
        groupBy: 'reason',
        metric: 'duration',
        unit: 's',
        scheduleClass: null,
        includeMicroStops: false,
        parentReasonId: null,
        groups: [{ key: 'r1', label: 'R1', value: '5400', share: '1', cumulativeShare: '1', periods: 3 }],
        total: '5400',
        summary: [],
        calculationRunIds: ['run-1', 'run-2'],
      },
      calculationRunId: null,
      policyVersion: null,
      dataQuality: { missingCount: 0, provisionalCount: 0 },
      coverage: { from: filters.from, to: filters.to, ratio: 1 },
      isProvisional: false,
      asOf: '2026-10-09T00:00:00Z',
      scope: { tenantId: 'tenant-a', unitIds: ['u1', 'u2'] },
    };
    const snapshot = reportSnapshot(response, filters);
    expect(snapshot.calculationRunIds).toEqual(['run-1', 'run-2']);
    expect(snapshot.data.groups).toBe(response.data.groups);
    expect(snapshot.exportRequest).toMatchObject({ revisionSelector: 'published', from: filters.from, to: filters.to, unitIds: filters.unitIds });
    expect(reportKey('tenant-a', 'downtime', filters, 'Asia/Tehran')).toEqual(
      reportKey('tenant-a', 'downtime', { ...filters, unitIds: ['u1', 'u2'] }, 'Asia/Tehran'),
    );
    expect(reportSnapshot({ ...response, isProvisional: true }, filters).exportRequest).toBeNull();
  });
});
