import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const heading = (name: string) => () => <h2>{name}</h2>;

vi.mock('@/api/v2/queries/use-v2-tenant', () => ({ useV2TenantId: () => 'tenant-a' }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ session: { tenant: { name: 'Plant A' } } }) }));
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/features/event-hub/event-hub-env', () => ({ EventHubEnvProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('./use-dashboard-scope', () => ({ useDashboardScope: () => ({ key: '7d', setKey: vi.fn(), scope: {}, node: {}, orgOnly: false }) }));
vi.mock('./dashboard-header', () => ({ DashboardHeader: () => null }));
vi.mock('./for-you-row', () => ({ ForYouRow: () => null }));
vi.mock('./dashboard-links', () => ({ eventsHref: () => '/events' }));
vi.mock('./reconciliation-tiles', () => ({ ReconciliationTiles: () => null }));
vi.mock('./latest-events', () => ({ LatestEvents: () => null }));
vi.mock('./oee-section', () => ({ OeeSection: heading('OEE') }));
vi.mock('./production-plan-section', () => ({ ProductionPlanSection: heading('Production vs plan') }));
vi.mock('./downtime-section', () => ({ DowntimeSection: heading('Downtime') }));
vi.mock('./reliability-section', () => ({ ReliabilitySection: heading('Asset reliability') }));

const { AnalyticsDashboard } = await import('./analytics-dashboard');

describe('AnalyticsDashboard', () => {
  it('renders each section once, in order', () => {
    render(
      <MemoryRouter>
        <AnalyticsDashboard />
      </MemoryRouter>,
    );
    const headings = screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent);
    expect(headings).toEqual(['OEE', 'Production vs plan', 'Downtime', 'Asset reliability', 'Reconciliation', 'Latest loss events']);
  });
});
