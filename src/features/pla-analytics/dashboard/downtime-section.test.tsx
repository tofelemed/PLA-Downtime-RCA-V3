import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { DowntimeBar } from '../charts/downtime-trend-bars';
import type { ParetoBar } from '../charts/downtime-pareto-bars';

const state = vi.hoisted(() => ({
  canViewOperations: true,
  canViewAnalysis: true,
  bundle: undefined as unknown,
  failed: false,
  refetch: vi.fn(),
  requests: [] as unknown[],
  trend: [] as Array<{ rows: DowntimeBar[]; classes: string[] }>,
  pareto: [] as ParetoBar[][],
}));

vi.mock('@/features/auth/use-capabilities', () => ({ useCapabilities: () => ({ canViewOperations: state.canViewOperations, canViewAnalysis: state.canViewAnalysis }) }));
vi.mock('@/features/event-hub/use-event-hub-env', () => ({ useEventHubEnv: () => ({ timezone: 'UTC' }) }));
vi.mock('@/features/downtime-analysis/hooks/use-downtime-bundle', () => ({
  useDowntimeBundle: (query: unknown) => {
    state.requests.push(query);
    if (state.failed) return { data: undefined, isLoading: false, isError: true, error: new Error('boom'), refetch: state.refetch };
    return { data: { data: state.bundle, isProvisional: false }, isLoading: false, isError: false, error: null, refetch: state.refetch };
  },
}));
vi.mock('../charts/downtime-trend-bars', () => ({
  DowntimeTrendBars: (props: { rows: DowntimeBar[]; classes: string[] }) => {
    state.trend.push(props);
    return <div data-testid="trend-mock">{props.classes.join(',')}</div>;
  },
}));
vi.mock('../charts/downtime-pareto-bars', () => ({
  DowntimeParetoBars: (props: { rows: ParetoBar[] }) => {
    state.pareto.push(props.rows);
    return <div data-testid="pareto-mock" />;
  },
}));
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });

const { parseScope } = await import('../model/analytics-scope');
const { TooltipProvider } = await import('@/components/ui/tooltip');
const { DowntimeSection } = await import('./downtime-section');
const { SCHEDULED_AVAILABILITY_CAPTION } = await import('./availability-captions');

const SCOPE = { ...parseScope(new URLSearchParams('from=2026-10-12T00:00:00.000Z&to=2026-10-19T00:00:00.000Z'), 0), trendBy: 'day' as const };
const kpi = (metric: string, value: string | null, reason: string | null = null) => ({ metric, value, reason, numerator: null, denominator: null });
const group = (key: string, value: string, cumulativeShare: string | null = null, label: string | null = key) => ({ key, label, value, share: null, cumulativeShare, periods: 1 });
const view = (token: string, groups: unknown[]) => ({ view: token, groupBy: token.split(':')[0], metric: 'duration', unit: 's', scheduleClass: null, groups, total: '0' });

function bundle(extra: unknown[] = [], external = '0') {
  return {
    includeMicroStops: false,
    summary: [kpi('downtime_total', '7200'), kpi('downtime_planned', '1800'), kpi('downtime_unplanned', '5400'), kpi('stop_count', '12.0000000000'), kpi('scheduled_availability', '0.973'), kpi('controllable_availability', '0.98')],
    views: [
      view('day:duration:planned', [group('2026-10-12', '1800')]),
      view('day:duration:unplanned', [group('2026-10-12', '5400'), group('2026-10-13', '600')]),
      view('day:duration:external', [group('2026-10-12', external)]),
      view('day:duration:unknown', [group('2026-10-12', '0')]),
      view('day:frequency', [group('2026-10-12', '9'), group('2026-10-13', '3')]),
      view('reason:duration:unplanned', ['a', 'b', 'c', 'd', 'e', 'f'].map((k, i) => group(k, String(600 - i * 50), String(0.1 * (i + 1)), `Reason ${k}`))),
      ...extra,
    ],
    calculationRunIds: [],
  };
}

function renderSection(assetId?: string) {
  state.trend = [];
  state.pareto = [];
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <TooltipProvider>
          <DowntimeSection scope={SCOPE} assetId={assetId} />
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const tile = (metric: string) => screen.getByTestId(`dashboard-downtime-${metric}-tile`);

describe('DowntimeSection', () => {
  it('shows exactly the five headline tiles from the server summary, with the controllable one on request', async () => {
    state.bundle = bundle();
    renderSection();
    const titles = ['Total downtime', 'Planned', 'Unplanned', 'Stops', 'Scheduled availability'];
    ['downtime_total', 'downtime_planned', 'downtime_unplanned', 'stop_count', 'scheduled_availability'].forEach((metric, i) => expect(within(tile(metric)).getByText(titles[i])).toBeInTheDocument());
    expect(within(tile('stop_count')).getByTestId('downtime-tile-value')).toHaveTextContent('12');
    expect(within(tile('scheduled_availability')).getByTestId('downtime-tile-value')).toHaveTextContent('97.3');
    expect(screen.queryByTestId('dashboard-downtime-controllable_availability-tile')).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId('dashboard-controllable-switch'));
    expect(within(tile('controllable_availability')).getByTestId('downtime-tile-value')).toHaveTextContent('98');
  });

  it('keeps the "not the OEE availability" caption in the tooltip only', async () => {
    state.bundle = bundle();
    renderSection();
    expect(screen.queryByText(SCHEDULED_AVAILABILITY_CAPTION)).not.toBeInTheDocument();
    await userEvent.hover(screen.getByRole('button', { name: 'About Scheduled availability' }));
    expect((await screen.findAllByText(SCHEDULED_AVAILABILITY_CAPTION)).length).toBeGreaterThan(0);
  });

  it('requests one bundle with the four class series, the stops series and the unplanned reasons', () => {
    state.bundle = bundle();
    state.requests = [];
    renderSection();
    expect((state.requests.at(-1) as { views: string[] }).views).toEqual(['day:duration:planned', 'day:duration:unplanned', 'day:duration:external', 'day:duration:unknown', 'day:frequency', 'reason:duration:unplanned']);
  });

  it('lists External and Unknown only when a step has a non-zero value', async () => {
    state.bundle = bundle();
    const { unmount } = renderSection();
    expect((await screen.findByTestId('trend-mock')).textContent).toBe('planned,unplanned');
    unmount();
    state.bundle = bundle([], '3600');
    renderSection();
    expect((await screen.findByTestId('trend-mock')).textContent).toBe('planned,unplanned,external');
  });

  it('joins the series by key: durations per class and the stop count land on the same step', async () => {
    state.bundle = bundle();
    renderSection();
    await screen.findByTestId('trend-mock');
    const rows = state.trend.at(-1)?.rows ?? [];
    expect(rows).toHaveLength(2);
    expect(rows[0].durations).toMatchObject({ planned: '1800', unplanned: '5400' });
    expect(rows[0].stops).toBe('9');
    expect(rows[1].durations.planned).toBeUndefined();
    expect(rows[1].stops).toBe('3');
  });

  it('draws the top 5 unplanned reasons with the server cumulative share', async () => {
    state.bundle = bundle();
    renderSection();
    await screen.findByTestId('pareto-mock');
    const rows = state.pareto.at(-1) ?? [];
    expect(rows.map((row) => row.name)).toEqual(['Reason a', 'Reason b', 'Reason c', 'Reason d', 'Reason e']);
    expect(rows[1].cumulativeShare).toBe('0.2');
  });

  it('with an asset selected shows the asset rows for downtime and stops, "—" for the rest, and says the charts are the unit', async () => {
    state.bundle = bundle([view('asset:duration', [group('asset-9', '900'), group('asset-1', '100')]), { ...view('asset:frequency', [group('asset-9', '4'), group('asset-1', '1')]), metric: 'frequency' }]);
    state.requests = [];
    renderSection('asset-9');
    expect((state.requests.at(-1) as { views: string[] }).views).toEqual(expect.arrayContaining(['asset:duration', 'asset:frequency']));
    expect(within(tile('downtime_total')).getByTestId('downtime-tile-value')).toHaveTextContent('15 min');
    expect(within(tile('stop_count')).getByTestId('downtime-tile-value')).toHaveTextContent('4');
    for (const metric of ['downtime_planned', 'downtime_unplanned', 'scheduled_availability']) {
      expect(tile(metric)).toHaveTextContent('—');
      expect(within(tile(metric)).queryByTestId('downtime-tile-value')).not.toBeInTheDocument();
    }
    await userEvent.hover(screen.getByRole('button', { name: 'About Planned' }));
    expect((await screen.findAllByText('Not available for a single asset')).length).toBeGreaterThan(0);
    expect(screen.getByTestId('downtime-trend-subtitle')).toHaveTextContent('selected asset');
    expect(screen.getByTestId('downtime-pareto-subtitle')).toHaveTextContent('selected asset');
  });

  it('shows an error with Retry when the request fails, never a plain "—"', async () => {
    state.failed = true;
    renderSection();
    await userEvent.click(await screen.findByRole('button', { name: /retry/i }));
    expect(state.refetch).toHaveBeenCalled();
    expect(screen.queryByTestId('dashboard-downtime-downtime_total-tile')).not.toBeInTheDocument();
    state.failed = false;
  });

  it('links to the Downtime analysis page', () => {
    state.bundle = bundle();
    renderSection();
    expect(screen.getByRole('link', { name: /Downtime analysis/ })).toBeInTheDocument();
  });

  it('keeps the link for an operations-only user and hides it without operations access', () => {
    state.bundle = bundle();
    state.canViewAnalysis = false;
    const { unmount } = renderSection();
    expect(screen.getByRole('link', { name: /Downtime analysis/ })).toBeInTheDocument();
    unmount();
    state.canViewOperations = false;
    renderSection();
    expect(screen.queryByRole('link', { name: /Downtime analysis/ })).not.toBeInTheDocument();
    state.canViewOperations = true;
    state.canViewAnalysis = true;
  });

  it('highlights Total downtime, not Unplanned', () => {
    state.bundle = bundle();
    renderSection();
    expect(tile('downtime_total').className).toContain('border-primary');
    expect(tile('downtime_unplanned').className).not.toContain('border-primary');
  });
});
