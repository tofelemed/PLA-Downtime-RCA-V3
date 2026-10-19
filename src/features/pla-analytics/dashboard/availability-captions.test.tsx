import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ session: { tenant: { id: 'tenant-a' } } }) }));
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/features/event-hub/use-event-hub-env', () => ({ useEventHubEnv: () => ({ timezone: 'UTC', unitName: (id: string) => id }) }));
const kpi = (metric: string, value: string) => ({ metric, value, reason: null, numerator: null, denominator: null });
vi.mock('@/api/v2/queries/reports', async (original) => ({
  ...await original<typeof import('@/api/v2/queries/reports')>(),
  useOeeReport: () => ({ data: { data: { label: 'Operational OEE (ISO 22400)', total: [kpi('oee', '0.924'), kpi('availability', '0.938'), kpi('performance', '0.99'), kpi('quality', '0.99')], groups: [] }, isProvisional: false }, isLoading: false, isError: false, error: null, refetch: () => undefined }),
  useDowntimeReport: () => ({ data: { data: { summary: [kpi('scheduled_availability', '0.973')], groups: [] }, isProvisional: false }, isLoading: false, isError: false, error: null, refetch: () => undefined }),
}));

const { parseScope } = await import('../model/analytics-scope');
const { DashboardOee } = await import('./dashboard-oee');
const { DashboardDowntime } = await import('./dashboard-downtime');
const { OEE_AVAILABILITY_CAPTION, SCHEDULED_AVAILABILITY_CAPTION } = await import('./availability-captions');

const SCOPE = parseScope(new URLSearchParams('from=2026-10-12T00:00:00.000Z&to=2026-10-19T00:00:00.000Z'), 0);

describe('dashboard: two availabilities, each with its scope caption (QA PLA re-test)', () => {
  it('the OEE availability and the scheduled availability say what they are measured on', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <DashboardOee scope={SCOPE} policy="operational" />
          <DashboardDowntime scope={SCOPE} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByTestId('dashboard-oee-availability')).toHaveTextContent(OEE_AVAILABILITY_CAPTION);
    expect(screen.getByTestId('kpi-scheduled_availability')).toHaveTextContent(SCHEDULED_AVAILABILITY_CAPTION);
  });
});
