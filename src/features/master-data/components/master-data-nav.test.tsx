import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { actAs } from '@/test/acting-user';
import { stubV2Fetch } from '@/test/v2-fetch';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { MasterDataNav } = await import('./master-data-nav');
const { MasterDataOverviewPage } = await import('../overview/master-data-overview-page');

const wrap = (node: ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/master-data']}>{node}</MemoryRouter>
    </QueryClientProvider>,
  );

const linkNames = () => within(screen.getByRole('navigation', { name: 'Master data sections' })).getAllByRole('link').map((l) => l.textContent);

describe('master-data links by capability', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin');
  });

  it('a master-data admin sees every section and Codes & rules', () => {
    actAs('master_data_admin');
    wrap(<MasterDataNav />);
    expect(linkNames()).toEqual([
      'Overview', 'Units', 'Assets', 'Products', 'Plant hierarchy', 'RCA templates', 'Cause library', 'Verification checklists',
      'Failure dictionary', 'Stop and plan policy', 'Standby equipment', 'Work-order operations', 'Unit state', 'Codes & rules',
    ]);
  });

  it('a reliability engineer sees only the pages it writes', () => {
    actAs('reliability_engineer');
    wrap(<MasterDataNav />);
    expect(linkNames()).toEqual(['Overview', 'Standby equipment', 'Work-order operations']);
  });

  it('the overview of an approver without master-data rights lists its pages instead of refusing', () => {
    stubV2Fetch(() => undefined);
    actAs('manager_approver');
    wrap(<MasterDataOverviewPage />);
    const pages = within(screen.getByRole('list', { name: 'Master data pages you can open' })).getAllByRole('link').map((l) => l.textContent);
    expect(pages).toEqual(['Stop and plan policy', 'Standby equipment', 'Work-order operations', 'Unit state']);
    expect(screen.queryByText(/don't have permission/)).toBeNull();
  });

  it('a production engineer is still refused', () => {
    stubV2Fetch(() => undefined);
    actAs('production_engineer');
    wrap(<MasterDataOverviewPage />);
    expect(screen.getByText(/don't have permission to access master data management/)).toBeInTheDocument();
  });
});
