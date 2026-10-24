import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { actAs } from '@/test/acting-user';
import { jsonResponse, listPage, stubV2Fetch } from '@/test/v2-fetch';
import { codeAndName } from './record-label';

const ORG = { id: 'o1', code: 'MARUN', name: 'Marun', canEdit: true };
const PLANT = { id: 'tenant-a', code: 'P1', name: 'HDPE plant', organizationId: 'o1', canEdit: true };
vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: { organization: ORG, tenant: PLANT }, setSelection: vi.fn(), loading: false }) }));
vi.mock('@/features/plant-selector/use-plant-directory', () => ({
  usePlantDirectory: () => ({ organizations: [ORG], tenants: [PLANT], isLoading: false, error: null, retry: vi.fn() }),
}));

const { HierarchyPage } = await import('./hierarchy-page');

const UNITS = [
  { id: 'u1', code: 'EXT-Line2', name: 'EXT-Line2', retiredAt: null },
  { id: 'u2', code: 'Extruder1', name: 'HDPE Extruder 1', retiredAt: null },
];

const show = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/master-data/hierarchy']}>
        <HierarchyPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

// Plant & equipment cleanup (25 Oct 2026)
describe('plant hierarchy page', () => {
  beforeEach(() => {
    actAs('SuperAdmin');
    stubV2Fetch((call) => (call.url.pathname === '/api/v2/units' ? jsonResponse(200, listPage(UNITS)) : undefined));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('has no header or section description; the tree is in a card with the ⓘ and an Organizations & plants link', async () => {
    show();
    const tree = await screen.findByRole('list', { name: 'Plant hierarchy' });
    expect(screen.queryByText('Organization, plants, units and assets of the plants you can work in.')).toBeNull();
    expect(screen.queryByText(/are managed in/)).toBeNull();
    const card = screen.getByTestId('hierarchy-card');
    expect(card).toContainElement(tree);
    expect(within(card).getByRole('button', { name: 'About Hierarchy' })).toBeTruthy();
    expect(within(card).getByRole('link', { name: 'Organizations & plants' })).toHaveAttribute('href', '/setup/plants');
    expect(within(card).getByRole('searchbox', { name: 'Search units and assets' }).parentElement).toHaveClass('[&_input]:h-9');
  });

  it('names a unit once when its code repeats its name; actions stay', async () => {
    show();
    expect(await screen.findByText('EXT-Line2', { exact: true })).toBeTruthy();
    expect(screen.queryByText('EXT-Line2 — EXT-Line2')).toBeNull();
    expect(screen.getByText('Extruder1 — HDPE Extruder 1')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open unit EXT-Line2' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Add unit to HDPE plant' })).toBeTruthy();
  });

  it('the search replaces the tree', async () => {
    show();
    await screen.findByRole('list', { name: 'Plant hierarchy' });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search units and assets' }), { target: { value: 'EXT' } });
    expect(await screen.findByRole('list', { name: 'Search results' }, { timeout: 3000 })).toBeTruthy();
  });

  it('codeAndName compares code and name without case or spaces', () => {
    expect(codeAndName('EXT-1', ' ext-1 ')).toBe(' ext-1 ');
    expect(codeAndName('EXT-1', 'Extruder')).toBe('EXT-1 — Extruder');
  });
});
