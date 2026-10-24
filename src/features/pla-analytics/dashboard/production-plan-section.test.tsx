import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { PlanBar } from '../charts/plan-trend-bars';

const state = vi.hoisted(() => ({ canViewOperations: true, totals: [] as unknown[], buckets: [] as unknown[], lossGroups: [] as unknown[], bars: [] as unknown[], lossQueries: [] as unknown[], fail: false, refetch: vi.fn() }));

vi.mock('@/features/auth/use-capabilities', () => ({ useCapabilities: () => ({ canViewOperations: state.canViewOperations }) }));
vi.mock('@/features/event-hub/use-event-hub-env', () => ({ useEventHubEnv: () => ({ timezone: 'UTC' }) }));
vi.mock('../charts/plan-trend-bars', () => ({
  PlanTrendBars: (props: { rows: PlanBar[]; uom: string }) => {
    state.bars.push(props);
    return <div data-testid="plan-bars-mock" />;
  },
}));

const result = (data: unknown) => ({ data: { data, isProvisional: false }, isLoading: false, isError: false, error: null, refetch: () => undefined });
vi.mock('@/api/v2/queries/pla-analytics', async (original) => ({
  ...(await original<typeof import('@/api/v2/queries/pla-analytics')>()),
  useReconciliationTrend: () => {
    if (state.fail) return { data: undefined, isLoading: false, isError: true, error: new Error('boom'), refetch: state.refetch };
    return result({ groupBy: 'day', buckets: state.buckets, totals: state.totals });
  },
  useLossTree: (query: unknown) => {
    state.lossQueries.push(query);
    return result({ groups: state.lossGroups });
  },
}));

const { parseScope } = await import('../model/analytics-scope');
const { TooltipProvider } = await import('@/components/ui/tooltip');
const { ProductionPlanSection } = await import('./production-plan-section');

const SCOPE = { ...parseScope(new URLSearchParams('from=2026-10-12T00:00:00.000Z&to=2026-10-19T00:00:00.000Z'), 0), trendBy: 'day' as const };
const row = (key: string, uom: string | null, over: Record<string, unknown> = {}) => ({
  key, uom, plan: '1000', actual: '900', shortfall: '100', explained: '60', unexplained: '40', unexplainedOfPlan: '0.04', unexplainedOfShortfall: '0.4',
  unexplainedTarget: null, unexplainedAboveTarget: false, periods: 3, excludedSlices: 0, ...over,
});
const loss = (key: string, unit: string, amount: string) => ({ key, label: key, unit, amount });

function renderSection(assetSelected = false) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <TooltipProvider>
          <ProductionPlanSection scope={SCOPE} assetSelected={assetSelected} />
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const tile = (id: string) => screen.getByTestId(`dashboard-plan-${id}-tile`);
const lastBars = () => state.bars.at(-1) as { rows: PlanBar[]; uom: string };

describe('ProductionPlanSection', () => {
  it('shows the five tiles with the totals row values verbatim and the unexplained notes', () => {
    state.totals = [row('total', 't', { plan: '1234.5', actual: '1100', shortfall: '134.5', explained: '90.5', unexplained: '44' })];
    state.buckets = [];
    renderSection();
    expect(tile('plan')).toHaveTextContent('1,234.50 t');
    expect(tile('actual')).toHaveTextContent('1,100.00 t');
    expect(tile('shortfall')).toHaveTextContent('134.50 t');
    expect(tile('explained')).toHaveTextContent('90.50 t');
    expect(tile('unexplained')).toHaveTextContent('44.00 t');
    expect(screen.getByTestId('plan-unexplained-of-plan')).toHaveTextContent('4 % of plan');
    expect(screen.getByTestId('plan-unexplained-of-shortfall')).toHaveTextContent('40 % of shortfall');
    expect(screen.queryByTestId('plan-above-target')).not.toBeInTheDocument();
    const ids = ['plan', 'actual', 'shortfall', 'explained', 'unexplained'];
    ['Plan', 'Actual', 'Shortfall', 'Explained loss', 'Unexplained'].forEach((title, i) => {
      expect(within(tile(ids[i])).getByText(title)).toBeInTheDocument();
    });
  });

  it('flags "above target" when the server says so', () => {
    state.totals = [row('total', 't', { unexplainedAboveTarget: true })];
    renderSection();
    expect(screen.getByTestId('plan-above-target')).toHaveTextContent('above target');
  });

  it('hides the picker with one unit and defaults to the unit with the largest plan with two', async () => {
    state.totals = [row('total', 't')];
    const { unmount } = renderSection();
    expect(screen.queryByTestId('plan-uom-picker')).not.toBeInTheDocument();
    unmount();
    state.totals = [row('total', 'm', { plan: '50', actual: '45' }), row('total', 't', { plan: '1000', actual: '900' }), row('total', null, { plan: '5000' })];
    renderSection();
    expect(screen.getByTestId('plan-uom-picker')).toBeInTheDocument();
    expect(tile('plan')).toHaveTextContent('1,000.00 t');
    await userEvent.click(screen.getByRole('button', { name: 'm' }));
    expect(tile('plan')).toHaveTextContent('50.00 m');
    expect(tile('actual')).toHaveTextContent('45.00 m');
    expect(screen.queryByText(/1,050/)).not.toBeInTheDocument();
  });

  it('switching the unit swaps the chart rows and the loss reasons', async () => {
    state.totals = [row('total', 't', { plan: '1000' }), row('total', 'm', { plan: '50' })];
    state.buckets = [row('2026-10-12', 't', { actual: '300', explained: '20', unexplained: '10' }), row('2026-10-12', 'm', { actual: '15', explained: '2', unexplained: '1' })];
    state.lossGroups = [loss('Jam', 't', '30'), loss('Wear', 'm', '3')];
    state.bars = [];
    renderSection();
    await screen.findByTestId('plan-bars-mock');
    expect(lastBars().uom).toBe('t');
    expect(lastBars().rows).toEqual([expect.objectContaining({ actual: '300', explained: '20', unexplained: '10' })]);
    expect(screen.getAllByTestId('plan-top-reason').map((li) => li.textContent)).toEqual(['Jam30.00 t']);
    await userEvent.click(screen.getByRole('button', { name: 'm' }));
    expect(lastBars().rows).toEqual([expect.objectContaining({ actual: '15', explained: '2', unexplained: '1' })]);
    expect(screen.getAllByTestId('plan-top-reason').map((li) => li.textContent)).toEqual(['Wear3.00 m']);
  });

  it('asks for five reasons (the server limits per unit of measure) and lists all five of the selected unit', async () => {
    state.totals = [row('total', 't', { plan: '1000' }), row('total', 'm', { plan: '50' })];
    state.lossGroups = [...['a', 'b', 'c', 'd', 'e'].map((k) => loss(k, 't', '9')), ...['v', 'w', 'x', 'y', 'z'].map((k) => loss(k, 'm', '1'))];
    state.lossQueries = [];
    renderSection();
    expect(state.lossQueries.at(-1)).toMatchObject({ groupBy: 'reason', metric: 'qty', limit: 5 });
    expect(screen.getAllByTestId('plan-top-reason')).toHaveLength(5);
    await userEvent.click(screen.getByRole('button', { name: 'm' }));
    expect(screen.getAllByTestId('plan-top-reason').map((li) => li.textContent)).toEqual(['v1.00 m', 'w1.00 m', 'x1.00 m', 'y1.00 m', 'z1.00 m']);
  });

  it('offers the Production loss analysis link only with canViewOperations', () => {
    state.totals = [row('total', 't')];
    const { unmount } = renderSection();
    expect(screen.getByRole('link', { name: /Production loss analysis/ })).toBeInTheDocument();
    unmount();
    state.canViewOperations = false;
    renderSection();
    expect(screen.queryByRole('link', { name: /Production loss analysis/ })).not.toBeInTheDocument();
    state.canViewOperations = true;
  });

  it('says the report is per unit when an asset is selected', () => {
    state.totals = [row('total', 't')];
    renderSection(true);
    expect(screen.getByTestId('dashboard-plan-asset-note')).toHaveTextContent('per unit');
  });

  it('shows an error with Retry when the request fails', async () => {
    state.fail = true;
    renderSection();
    await userEvent.click(await screen.findByRole('button', { name: /retry/i }));
    expect(state.refetch).toHaveBeenCalled();
    state.fail = false;
  });
});
