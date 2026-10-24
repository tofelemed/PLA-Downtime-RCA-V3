import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { actAs } from '@/test/acting-user';
import { jsonResponse, listPage, stubV2Fetch, type V2Call } from '@/test/v2-fetch';
import { dashboardScope } from '../model/dashboard-scope';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null, loading: false }) }));
vi.mock('@/features/event-hub/use-event-hub-env', () => ({ useEventHubEnv: () => ({ tenantId: 'tenant-a', timezone: 'UTC', timezoneIsFallback: false }) }));

const { DashboardHeader } = await import('./dashboard-header');
const { ForYouRow } = await import('./for-you-row');

const NOW = Date.parse('2026-10-18T08:00:00Z');
const LABELS = ['24 h', '7 days', '30 days', '3 months', '6 months', '1 year'];

function oee(call: V2Call): Response | undefined {
  if (!call.url.pathname.includes('/reports/oee')) return undefined;
  return jsonResponse(200, {
    data: { calculationRunIds: ['r1', 'r2'] },
    asOf: '2026-10-18T07:30:00Z',
    isProvisional: true,
    coverage: { ratio: 0.5 },
    dataQuality: { missingCount: 2 },
    policyVersion: ['oee-operational@1'],
  });
}

function renderHeader(orgOnly = false) {
  const onKey = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <MemoryRouter>
          <DashboardHeader scope={dashboardScope('7d', {}, NOW)} keyValue="7d" onKey={onKey} orgOnly={orgOnly} plantName="Marun" />
          <ForYouRow scope={dashboardScope('7d', {}, NOW)} />
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return onKey;
}

describe('DashboardHeader', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('offers the six periods as one radio group and reports the chosen key', async () => {
    actAs('viewer');
    stubV2Fetch(oee);
    const onKey = renderHeader();
    const group = screen.getByRole('radiogroup', { name: 'Time period' });
    expect(within(group).getAllByRole('radio').map((radio) => radio.parentElement?.textContent)).toEqual(LABELS);
    expect(within(group).getByRole('radio', { name: '7 days' })).toBeChecked();
    await userEvent.click(within(group).getByText('3 months'));
    expect(onKey).toHaveBeenCalledWith('3m');
  });

  it('has no description, scope label or timezone badge, and says Provisional once', async () => {
    actAs('viewer');
    stubV2Fetch(oee);
    renderHeader();
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(await screen.findAllByText(/^Provisional$/)).toHaveLength(1);
    expect(screen.queryByText(/Key figures of the selected plant/)).toBeNull();
    expect(screen.queryByText(/in your scope/)).toBeNull();
    expect(screen.queryByText(/^UTC/)).toBeNull();
    expect(screen.getByText(/^As of /)).toBeInTheDocument();
  });

  it('keeps the incomplete-data line and run details behind the badge', async () => {
    actAs('viewer');
    stubV2Fetch(oee);
    renderHeader();
    await userEvent.click(await screen.findByRole('button', { name: /Provisional/ }));
    expect(await screen.findByTestId('snapshot-incomplete')).toHaveTextContent('Incomplete data');
    expect(screen.getByText(/2 calculation runs/)).toBeInTheDocument();
  });

  it('says so when only an organisation is chosen', () => {
    actAs('viewer');
    stubV2Fetch(oee);
    renderHeader(true);
    expect(screen.getByText('Showing Marun — organisation-wide figures are not available yet')).toBeInTheDocument();
    expect(screen.queryByText(/^As of /)).toBeNull();
  });

  it('puts the For you row directly after the header', () => {
    actAs('manager_approver');
    stubV2Fetch((call) => oee(call) ?? jsonResponse(200, listPage([{ id: 'a' }, { id: 'b' }])));
    renderHeader();
    const header = screen.getByRole('banner');
    expect(header.nextElementSibling).toBe(screen.getByTestId('dashboard-for-you').closest('section'));
  });
});
