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

const wrap = (node: ReactNode, path = '/master-data') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>
    </QueryClientProvider>,
  );

const LINKS = { name: 'Pages of this setup area' };
const linkNames = () => within(screen.getByRole('navigation', LINKS)).getAllByRole('link').map((l) => l.textContent);

describe('master-data links by capability', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin');
  });

  // owner 21 Oct 2026: the link row shows the pages of the current Setup entry only
  it.each([
    ['/master-data/assets', ['Production units', 'Assets', 'Products', 'Plant hierarchy', 'Plant flow']],
    ['/master-data/failure-dictionary', ['Codes & rules', 'Failure dictionary']],
    ['/master-data/unit-state', ['Stop and plan policy', 'Standby equipment', 'Unit impact rules', 'Unit state']],
    ['/master-data/rca/causes', ['RCA templates', 'Cause library', 'Verification checklists']],
  ])('a master-data admin on %s sees the pages of that setup entry', (path, names) => {
    actAs('master_data_admin');
    wrap(<MasterDataNav />, path);
    expect(linkNames()).toEqual(names);
  });

  it('a single-page entry (Work-order operations) has no link row', () => {
    actAs('master_data_admin');
    wrap(<MasterDataNav />, '/master-data/work-orders');
    expect(screen.queryByRole('navigation', LINKS)).toBeNull();
  });

  it('a reliability engineer sees the pages it writes and the failure dictionary it reads (re-test N9)', () => {
    actAs('reliability_engineer');
    wrap(<MasterDataNav />, '/master-data/standby-equipment');
    expect(linkNames()).toEqual(['Standby equipment', 'Unit impact rules']);
  });

  it('an operator sees every page it can open, and no row for a single page (QA L1)', () => {
    actAs('operator');
    wrap(<MasterDataNav />, '/master-data/standby-equipment');
    expect(screen.queryByRole('navigation', LINKS)).toBeNull();
  });

  it('the overview of an approver without master-data rights lists its pages instead of refusing', () => {
    stubV2Fetch(() => undefined);
    actAs('manager_approver');
    wrap(<MasterDataOverviewPage />);
    const pages = within(screen.getByRole('list', { name: 'Master data pages you can open' })).getAllByRole('link').map((l) => l.textContent);
    expect(pages).toEqual(['Codes & rules', 'Plant flow', 'Stop and plan policy', 'Standby equipment', 'Unit impact rules', 'Work-order operations', 'Unit state']);
    expect(screen.queryByText(/don't have permission/)).toBeNull();
  });

  it('a production engineer can reach codes without master-data write access', () => {
    stubV2Fetch(() => undefined);
    actAs('production_engineer');
    wrap(<MasterDataOverviewPage />);
    const pages = within(screen.getByRole('list', { name: 'Master data pages you can open' })).getAllByRole('link').map((l) => l.textContent);
    expect(pages).toEqual(['Codes & rules']);
    expect(screen.queryByText(/don't have permission/)).toBeNull();
  });
});
