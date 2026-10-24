import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReliabilityBar } from '../charts/mtbf-trend-lines';

const state = vi.hoisted(() => ({
  trend: undefined as unknown,
  trendFailed: false,
  trendRequests: [] as unknown[],
  bundleRequests: [] as unknown[],
  bundle: undefined as unknown,
  charts: [] as ReliabilityBar[][],
  refetch: vi.fn(),
}));

vi.mock('@/features/auth/use-capabilities', () => ({ useCapabilities: () => ({ canViewOperations: true, canViewAnalysis: true }) }));
vi.mock('@/features/event-hub/use-event-hub-env', () => ({ useEventHubEnv: () => ({ timezone: 'UTC' }) }));
vi.mock('@/api/v2/queries/rca-cases', () => ({
  useRcaSummary: () => ({ data: { open: 4, overdue: 1, critical: 0, overdueActions: 3, effectivenessPending: 2 }, isLoading: false, isError: false, error: null, refetch: vi.fn() }),
}));
vi.mock('@/api/v2/queries/ops-reports', () => ({
  useReliabilityTrend: (query: unknown) => {
    state.trendRequests.push(query);
    if (state.trendFailed) return { data: undefined, isLoading: false, isError: true, error: new Error('boom'), refetch: state.refetch };
    return { data: { data: state.trend }, isLoading: false, isError: false, error: null, refetch: state.refetch };
  },
}));
vi.mock('@/features/downtime-analysis/hooks/use-downtime-bundle', () => ({
  useDowntimeBundle: (query: unknown) => {
    state.bundleRequests.push(query);
    return { data: { data: state.bundle }, isLoading: false, isError: false, error: null, refetch: state.refetch };
  },
}));
vi.mock('../charts/mtbf-trend-lines', () => ({
  MtbfTrendLines: (props: { rows: ReliabilityBar[] }) => {
    state.charts.push(props.rows);
    return <div data-testid="mtbf-mock" />;
  },
}));
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });

const { dashboardScope } = await import('../model/dashboard-scope');
const { TooltipProvider } = await import('@/components/ui/tooltip');
const { ReliabilitySection } = await import('./reliability-section');

const kpi = (metric: string, value: string | null) => ({ metric, value, reason: null, numerator: null, denominator: null });
const month = (key: string, mtbf: string, mttr: string) => ({ month: key, row: { exposureSeconds: null, failures: null, mtbf: kpi('mtbf', mtbf), meanDowntimeToRestore: kpi('mdtr', null), mttr: kpi('mttr', mttr) } });
const trend = (fallingMtbf: boolean) => ({ months: ['2026-08', '2026-09'], units: [], assets: [], total: { months: [month('2026-08', '7200', '600'), month('2026-09', '3600', '900')], fallingMtbf }, failureDefinition: '' });
const group = (key: string, label: string, value: string) => ({ key, label, value, share: null, cumulativeShare: null, periods: 1 });
const view = (token: string, groups: unknown[]) => ({ view: token, groupBy: 'asset', metric: 'frequency', unit: 'count', scheduleClass: null, groups, total: '0' });

function renderSection(key: '7d' | '3m' = '7d', node: { unitId?: string; assetId?: string } = {}, failed = false, falling = false) {
  state.trendRequests = [];
  state.bundleRequests = [];
  state.charts = [];
  state.trendFailed = failed;
  state.trend = trend(falling);
  state.bundle = {
    summary: [],
    views: [
      view('asset:frequency', [group('a-1', 'Pump 1', '5'), group('a-2', 'Fan 2', '3')]),
      view('asset:duration', [group('a-2', 'Fan 2', '5400'), group('a-1', 'Pump 1', '7200')]),
    ],
  };
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <TooltipProvider>
          <ReliabilitySection scope={dashboardScope(key, node)} node={node} />
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ReliabilitySection', () => {
  it('shows the five RCA tiles with their links', () => {
    renderSection();
    for (const title of ['Open investigations', 'Overdue investigations', 'Open critical', 'Overdue actions', 'Effectiveness pending']) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: 'Investigations' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cause portfolio' })).toBeInTheDocument();
  });

  it('draws the server months and, for a 7-day period, says it shows the last 6 months', async () => {
    renderSection('7d');
    expect(screen.getByTestId('mtbf-trend-subtitle')).toHaveTextContent('monthly · last 6 months');
    expect(await screen.findByTestId('mtbf-mock')).toBeInTheDocument();
    expect(state.charts[0].map((row) => [row.mtbf, row.mttr])).toEqual([['7200', '600'], ['3600', '900']]);
    const { from, to } = state.trendRequests[0] as { from: string; to: string };
    expect((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000).toBeGreaterThan(180);
  });

  it('keeps the dashboard period from 3 months on', () => {
    renderSection('3m');
    expect(screen.getByTestId('mtbf-trend-subtitle')).toHaveTextContent(/^monthly$/);
  });

  it('asks for the selected asset only', () => {
    renderSection('7d', { unitId: 'u-1', assetId: 'a-1' });
    expect(state.trendRequests[0]).toMatchObject({ unitIds: ['u-1'], assetIds: ['a-1'] });
  });

  it('flags a falling MTBF with text and an icon', () => {
    const { unmount } = renderSection();
    expect(screen.queryByTestId('mtbf-falling-chip')).toBeNull();
    unmount();
    renderSection('7d', {}, false, true);
    expect(screen.getByTestId('mtbf-falling-chip')).toHaveTextContent('MTBF falling 3 months in a row');
  });

  it('offers a retry when the reliability request fails', async () => {
    renderSection('7d', {}, true);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(state.refetch).toHaveBeenCalled();
  });

  it('lists the most stopped assets with Asset / Stops / Downtime from one bundle call', () => {
    renderSection();
    const table = within(screen.getByTestId('dashboard-top-assets')).getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Asset', 'Stops', 'Downtime']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Pump 1');
    expect(rows[0]).toHaveTextContent('2 h');
    expect(rows[1]).toHaveTextContent('Fan 2');
    expect(rows[1]).toHaveTextContent('1 h 30 min');
    expect(state.bundleRequests).toHaveLength(1);
    expect((state.bundleRequests[0] as { views: string[] }).views).toEqual(['asset:duration', 'asset:frequency']);
  });
});
