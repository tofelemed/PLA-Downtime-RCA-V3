import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { configureV2Session } from '@/api/v2/config';
import { useLossTree } from '@/api/v2/queries/pla-analytics';
import { reportSnapshot, useDowntimeReport } from '@/api/v2/queries/reports';
import type { AnalyticsResponse } from '@/api/v2/types/envelopes';
import type { DowntimeReportView } from '@/api/v2/types/reports';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ session: { tenant: { id: 'tenant-a' } } }) }));
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { downtimeQuery, parseFilters, reportBase } = await import('./model/downtime-filters');
const { paretoQuery } = await import('./model/reason-drill');
const { lostProductionQuery } = await import('./model/lost-production');
const { KpiTile } = await import('./components/kpi-summary');
const { SUMMARY_TILES } = await import('./model/kpi-display');

const FILTERS = parseFilters(new URLSearchParams('from=2026-10-01T00:00:00.000Z&to=2026-10-08T00:00:00.000Z&window=W&units=u1&reasons=r1&approved=1'), 0);

const response = (runIds: string[]): AnalyticsResponse<DowntimeReportView> => ({
  data: {
    groupBy: 'oee', metric: 'duration', unit: 's', scheduleClass: null, includeMicroStops: false, parentReasonId: null,
    groups: [], total: '5400', summary: [], calculationRunIds: runIds,
  },
  calculationRunId: null, policyVersion: 'oee_policy@1', dataQuality: { missingCount: 0, provisionalCount: 0 },
  coverage: { from: FILTERS.from, to: FILTERS.to, ratio: 1 }, isProvisional: false, asOf: '2026-10-08T00:00:00.000Z', scope: { tenantId: 'tenant-a' },
});

describe('Downtime Analysis data flows (plan 3.3)', () => {
  let urls: URL[];
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

  beforeEach(() => {
    urls = [];
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      urls.push(new URL(url));
      return new Response(JSON.stringify(response(['run-1', 'run-2'])), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('T24: header and summary tiles read one request; its snapshot export carries the same filters and runs', async () => {
    const summary = downtimeQuery(FILTERS, 'oee', { metric: 'duration', scheduleClass: 'all' });
    const { result } = renderHook(() => [useDowntimeReport(summary, 'UTC'), useDowntimeReport({ ...summary }, 'UTC')] as const, { wrapper });
    await waitFor(() => expect(result.current[1].data).toBeDefined());
    expect(urls).toHaveLength(1);
    const snapshot = reportSnapshot(result.current[0].data!, reportBase(FILTERS));
    expect(snapshot.calculationRunIds).toEqual(result.current[1].data!.data.calculationRunIds);
    expect(snapshot.exportRequest).toMatchObject({ from: FILTERS.from, to: FILTERS.to, unitIds: ['u1'], revisionSelector: 'published' });
  });

  it('FE-08: lost production reads the loss tree of the page scope, availability lines only', async () => {
    renderHook(() => useLossTree(lostProductionQuery(FILTERS, 'qty'), 'UTC'), { wrapper });
    await waitFor(() => expect(urls).toHaveLength(1));
    const [url] = urls;
    expect(url.pathname).toMatch(/\/v2\/reports\/loss-tree$/);
    expect(url.searchParams.getAll('kinds')).toEqual(['availability']);
    expect(url.searchParams.get('groupBy')).toBe('reason');
    expect(url.searchParams.getAll('unitIds')).toEqual(['u1']);
    expect(url.searchParams.has('tenantId')).toBe(false);
  });

  it('the Pareto drill reaches the server as groupBy=reasonChild + parentReasonId; never a tenantId', async () => {
    renderHook(() => useDowntimeReport(paretoQuery(FILTERS), 'UTC'), { wrapper });
    await waitFor(() => expect(urls).toHaveLength(1));
    const [url] = urls;
    expect(url.pathname).toMatch(/\/v2\/reports\/downtime$/);
    expect(url.searchParams.get('groupBy')).toBe('reasonChild');
    expect(url.searchParams.get('parentReasonId')).toBe('r1');
    expect(url.searchParams.getAll('unitIds')).toEqual(['u1']);
    expect(url.searchParams.get('approvedOnly')).toBe('true');
    expect(url.searchParams.has('tenantId')).toBe(false);
  });

  it('a null KPI shows "—" with the server reason, never a default', () => {
    const tile = SUMMARY_TILES.find((entry) => entry.metric === 'mean_stop_duration')!;
    render(
      <dl>
        <KpiTile spec={tile} view={{ metric: tile.metric, numerator: '0', denominator: '0', value: null, unit: 's', quality: 'unavailable', reason: 'no_completed_stops', rows: 3, missing: 0 }} />
      </dl>,
    );
    expect(screen.getByTestId('kpi-value').textContent).toBe('—');
    expect(screen.getByText('No completed stops in the window')).toBeTruthy();
    expect(screen.getByText('Mean completed stop')).toBeTruthy();
  });
});
