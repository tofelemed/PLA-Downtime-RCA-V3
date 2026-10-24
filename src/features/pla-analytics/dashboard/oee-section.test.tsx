import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { SeriesChartProps } from '../charts/series-chart';

const state = vi.hoisted(() => ({ canViewAnalysis: true, trendGroups: [] as unknown[], lossGroups: [] as unknown[], chartProps: [] as unknown[], failOee: false, refetch: vi.fn() }));

vi.mock('@/features/auth/use-capabilities', () => ({ useCapabilities: () => ({ canViewAnalysis: state.canViewAnalysis }) }));
vi.mock('@/features/event-hub/use-event-hub-env', () => ({ useEventHubEnv: () => ({ timezone: 'UTC' }) }));
vi.mock('../charts/series-chart', () => ({
  SeriesChart: (props: SeriesChartProps) => {
    state.chartProps.push(props);
    return <div data-testid="series-chart-mock" />;
  },
}));

const kpi = (metric: string, value: string | null, reason: string | null = null) => ({ metric, value, reason, numerator: null, denominator: null });
const result = (data: unknown) => ({ data: { data, isProvisional: false }, isLoading: false, isError: false, error: null, refetch: () => undefined });
vi.mock('@/api/v2/queries/reports', async (original) => ({
  ...(await original<typeof import('@/api/v2/queries/reports')>()),
  useOeeReport: (query: { groupBy: string; policy: string }) => {
    if (state.failOee && query.groupBy === 'unit' && query.policy === 'operational') return { data: undefined, isLoading: false, isError: true, error: new Error('boom'), refetch: state.refetch };
    if (query.groupBy !== 'unit') return result({ label: 'Operational OEE (ISO 22400)', groups: state.trendGroups, total: [] });
    if (query.policy === 'reconciled') return result({ label: 'Reconciled PLA OEE', groups: [], total: [kpi('reconciled_oee', null, 'no_scheduled_time')] });
    return result({ label: 'Operational OEE (ISO 22400)', groups: [], total: [kpi('oee', '0.924'), kpi('availability', '0.938'), kpi('performance', '0.99'), kpi('quality', '0.99')] });
  },
}));
vi.mock('@/api/v2/queries/pla-analytics', async (original) => ({
  ...(await original<typeof import('@/api/v2/queries/pla-analytics')>()),
  useLossTree: () => result({ groups: state.lossGroups }),
}));

vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });

const { parseScope } = await import('../model/analytics-scope');
const { TooltipProvider } = await import('@/components/ui/tooltip');
const { OeeSection } = await import('./oee-section');
const { OEE_AVAILABILITY_CAPTION } = await import('./availability-captions');

const SCOPE = { ...parseScope(new URLSearchParams('from=2026-10-12T00:00:00.000Z&to=2026-10-19T00:00:00.000Z'), 0), trendBy: 'day' as const };
const group = (key: string, oee: string | null) => ({ key, label: key, metrics: [kpi('oee', oee), kpi('availability', '0.9')] });
const loss = (key: string | null, unit: string | null, amount: string) => ({ key, label: key, unit, amount });

function renderSection(assetSelected = false) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <TooltipProvider>
          <OeeSection scope={SCOPE} assetSelected={assetSelected} />
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('OeeSection', () => {
  it('shows the five tiles with plain titles and no ISO text outside the tooltips', () => {
    renderSection();
    const titles = ['Operational OEE', 'Availability', 'Performance', 'Quality', 'Reconciled PLA OEE'];
    const tiles = ['operational', 'availability', 'performance', 'quality', 'reconciled'].map((id) => screen.getByTestId(`dashboard-oee-${id}-tile`));
    tiles.forEach((tile, index) => expect(within(tile).getByText(titles[index])).toBeInTheDocument());
    expect(within(tiles[0]).getByTestId('oee-tile-value')).toHaveTextContent('92.4');
    expect(screen.queryByText(/ISO 22400/)).not.toBeInTheDocument();
    expect(screen.queryByText(OEE_AVAILABILITY_CAPTION)).not.toBeInTheDocument();
  });

  it('puts the ISO 22400 text and the availability caption in the tooltips', async () => {
    renderSection();
    await userEvent.hover(screen.getByRole('button', { name: 'About Operational OEE' }));
    expect((await screen.findAllByText(/Operational OEE \(ISO 22400\)/)).length).toBeGreaterThan(0);
    await userEvent.hover(screen.getByRole('button', { name: 'About Availability' }));
    expect((await screen.findAllByText(OEE_AVAILABILITY_CAPTION)).length).toBeGreaterThan(0);
  });

  it('shows "—" and the server reason in the tooltip when a value is missing', async () => {
    renderSection();
    expect(within(screen.getByTestId('dashboard-oee-reconciled-tile')).getByTestId('oee-tile-value')).toHaveTextContent('—');
    await userEvent.hover(screen.getByRole('button', { name: 'About Reconciled PLA OEE' }));
    expect((await screen.findAllByText(/Not available: No scheduled time/)).length).toBeGreaterThan(0);
  });

  it('offers the report link only with canViewAnalysis', () => {
    state.canViewAnalysis = true;
    const { unmount } = renderSection();
    expect(screen.getByRole('link', { name: /OEE and downtime report/ })).toBeInTheDocument();
    unmount();
    state.canViewAnalysis = false;
    renderSection();
    expect(screen.queryByRole('link', { name: /OEE and downtime report/ })).not.toBeInTheDocument();
    state.canViewAnalysis = true;
  });

  it('says OEE is per unit when an asset is selected', () => {
    renderSection(true);
    expect(screen.getByTestId('dashboard-oee-asset-note')).toHaveTextContent('OEE is calculated per unit');
  });
});

describe('OeeSection charts', () => {
  it('passes one row per server group, in order, with OEE only and no target line', async () => {
    state.trendGroups = [group('2026-10-14', '0.8'), group('2026-10-12', null), group('2026-10-13', '0.9')];
    state.chartProps = [];
    renderSection();
    await screen.findByTestId('series-chart-mock');
    const props = state.chartProps.at(-1) as SeriesChartProps;
    expect(props.rows.map((row) => row.values.oee)).toEqual(['0.8', null, '0.9']);
    expect(props.series.map((s) => s.key)).toEqual(['oee']);
    expect(props.kind).toBe('line');
  });

  it('toggles a component line on through an accessible button', async () => {
    state.trendGroups = [group('2026-10-12', '0.8')];
    renderSection();
    await screen.findByTestId('series-chart-mock');
    const button = within(screen.getByRole('group', { name: 'Lines on the chart' })).getByRole('button', { name: 'Availability' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect((state.chartProps.at(-1) as SeriesChartProps).series.map((s) => s.key)).toEqual(['oee', 'availability']);
  });

  it('shows the empty state when the server returns no groups', async () => {
    state.trendGroups = [];
    renderSection();
    expect(await screen.findByText('No OEE periods in this window.')).toBeInTheDocument();
    expect(screen.queryByTestId('series-chart-mock')).not.toBeInTheDocument();
  });

  it('draws the loss chart once per unit of measure and never adds across units', async () => {
    state.lossGroups = [loss('availability', 't', '10'), loss('quality', 't', '2'), loss('availability', 'm', '5')];
    renderSection();
    const units = await screen.findAllByTestId('oee-loss-unit');
    expect(units.map((unit) => unit.getAttribute('data-uom'))).toEqual(['t', 'm']);
    expect(units[0]).toHaveTextContent('Availability 10.00, Quality 2.00');
    expect(units[1]).toHaveTextContent('Availability 5.00');
    expect(screen.getByRole('heading', { name: 'Where production was lost · t' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Where production was lost · m' })).toBeInTheDocument();
  });
});

describe('OeeSection failed request', () => {
  it('shows an error with Retry instead of a plain "—"', async () => {
    state.failOee = true;
    renderSection();
    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByTestId('oee-tile-value')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(state.refetch).toHaveBeenCalled();
    state.failOee = false;
  });
});
