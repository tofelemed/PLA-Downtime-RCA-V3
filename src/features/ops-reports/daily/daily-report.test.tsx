import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { actAs } from '@/test/acting-user';
import { jsonResponse, stubV2Fetch, type V2Call } from '@/test/v2-fetch';
import { parseScope } from '@/features/pla-analytics/model/analytics-scope';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null, loading: false }) }));
vi.mock('@/features/event-hub/use-event-hub-env', () => ({ useEventHubEnv: () => ({ tenantId: 'tenant-a', timezone: 'UTC', timezoneIsFallback: false }) }));
vi.mock('@/api/v2/queries/month-close', () => ({ useMonthClose: () => ({ data: undefined }) }));
vi.mock('../components/report-export-bar', () => ({ ReportExportBar: () => null }));
vi.mock('../components/loss-breakdown-cards', () => ({ LossBreakdownCards: () => null }));
vi.mock('./production-table', () => ({ ProductionTable: () => null }));
vi.mock('./event-status-card', () => ({ EventStatusCard: () => null }));

const { DailyReport } = await import('./daily-report');

const kpi = (metric: string, value: string) => ({ metric, value, reason: null, numerator: null, denominator: null });

function oee(call: V2Call): Response | undefined {
  if (!call.url.pathname.includes('/reports/oee')) return undefined;
  return jsonResponse(200, {
    data: { label: 'Operational OEE (ISO 22400)', total: [kpi('oee', '0.8'), kpi('availability', '0.9'), kpi('performance', '0.95'), kpi('quality', '0.94')], calculationRunIds: ['r1'] },
    asOf: '2026-10-18T07:30:00Z',
    isProvisional: true,
    coverage: { ratio: 1 },
    dataQuality: { missingCount: 0 },
    policyVersion: ['oee-operational@1'],
  });
}

describe('DailyReport OEE', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the four operational OEE tiles in a titled card with its Provisional chip, and never asks for the reconciled OEE', async () => {
    actAs('viewer');
    const calls = stubV2Fetch(oee);
    const scope = parseScope(new URLSearchParams('from=2026-10-17T00:00:00.000Z&to=2026-10-18T00:00:00.000Z'), 0);
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <TooltipProvider>
          <MemoryRouter>
            <DailyReport scope={scope} dayStart="06:00" />
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>,
    );
    const card = await screen.findByTestId('dashboard-oee-operational');
    await waitFor(() => expect(within(card).getAllByTestId('oee-tile-value')).toHaveLength(4));
    expect(within(card).getByText('Operational OEE (ISO 22400)')).toBeInTheDocument();
    expect(within(card).getByText('Provisional')).toBeInTheDocument();
    for (const id of ['operational', 'availability', 'performance', 'quality']) expect(within(card).getByTestId(`dashboard-oee-${id}-tile`)).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-oee-reconciled-tile')).toBeNull();
    const oeeCalls = calls.filter((call) => call.url.pathname.includes('/reports/oee'));
    expect(oeeCalls.length).toBeGreaterThan(0);
    expect(oeeCalls.map((call) => call.url.searchParams.get('policy'))).not.toContain('reconciled');
  });
});
