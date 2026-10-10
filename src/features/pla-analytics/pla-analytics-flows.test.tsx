import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { configureV2Session } from '@/api/v2/config';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ session: { tenant: { id: 'tenant-a' } } }) }));
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { useLossTree, useReconciliationTrend, useScopeWaterfall } = await import('@/api/v2/queries/pla-analytics');
const { lossTreeQuery, parseScope, trendQuery, waterfallQuery } = await import('./model/analytics-scope');
const { OeeTile } = await import('./components/oee-tile');

const SCOPE = parseScope(new URLSearchParams('from=2026-10-01T00:00:00.000Z&to=2026-10-08T00:00:00.000Z&window=W&units=u1&trend=shift'), 0);

const envelope = (data: unknown) => ({
  data,
  calculationRunId: null,
  policyVersion: null,
  dataQuality: { missingCount: 0, provisionalCount: 0 },
  coverage: { from: SCOPE.from, to: SCOPE.to, ratio: 1 },
  isProvisional: true,
  asOf: '2026-10-08T00:00:00.000Z',
  scope: { tenantId: 'tenant-a' },
});

describe('PLA analytics data flows (plan 3.6)', () => {
  let urls: URL[];
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

  beforeEach(() => {
    urls = [];
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      urls.push(new URL(url));
      return new Response(JSON.stringify(envelope({ calculationRunIds: ['run-1'], bars: [], groups: [], totals: [], buckets: [] })), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('T24: the header and the Waterfall tab share one scope-waterfall request', async () => {
    const { result } = renderHook(() => [useScopeWaterfall(waterfallQuery(SCOPE), 'UTC'), useScopeWaterfall(waterfallQuery({ ...SCOPE }), 'UTC')] as const, { wrapper });
    await waitFor(() => expect(result.current[1].data).toBeDefined());
    expect(urls).toHaveLength(1);
    expect(urls[0].pathname).toMatch(/\/v2\/reports\/scope-waterfall$/);
    expect(urls[0].searchParams.get('ledger')).toBe('plan');
    expect(urls[0].searchParams.getAll('unitIds')).toEqual(['u1']);
    expect(urls[0].searchParams.has('tenantId')).toBe(false);
  });

  it('the trend selector and loss-tree controls are server parameters (B11)', async () => {
    renderHook(() => [useReconciliationTrend(trendQuery(SCOPE), 'UTC'), useLossTree(lossTreeQuery({ ...SCOPE, lossGroupBy: 'impact', lossMetric: 'margin' }), 'UTC')], { wrapper });
    await waitFor(() => expect(urls).toHaveLength(2));
    const trend = urls.find((url) => url.pathname.endsWith('/reconciliation-trend'));
    const tree = urls.find((url) => url.pathname.endsWith('/loss-tree'));
    expect(trend?.searchParams.get('groupBy')).toBe('shift');
    expect(tree?.searchParams.get('groupBy')).toBe('impact');
    expect(tree?.searchParams.get('metric')).toBe('margin');
  });

  it('T41: an OEE tile without a server value says why, never 87 % / 100 %', () => {
    render(<OeeTile title="OEE" label="Operational OEE (ISO 22400)" denominator="over scheduled time" testId="tile" view={{ metric: 'oee', numerator: '0', denominator: '0', value: null, unit: 'ratio', quality: 'unavailable', reason: 'no_scheduled_time', rows: 1, missing: 0 }} />);
    expect(screen.getByTestId('oee-tile-value').textContent).toBe('Not available: no scheduled time');
    expect(screen.getByText(/Operational OEE \(ISO 22400\)/)).toBeTruthy();
  });
});
