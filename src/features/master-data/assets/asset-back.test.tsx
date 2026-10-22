import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { actAs } from '@/test/acting-user';
import { jsonResponse, listPage, stubV2Fetch } from '@/test/v2-fetch';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null, setSelection: vi.fn(), loading: false }) }));

const { AssetDetailPage } = await import('./asset-detail-page');
const { UnitDetailPage } = await import('../units/unit-detail-page');
const { UnitAssetsSection } = await import('../units/unit-assets-section');
const { PlantNode } = await import('../hierarchy/plant-node');

const ASSET = { id: 'a1', code: 'GB-1', name: 'Gearbox', unitId: 'u1', retiredAt: null, rowVersion: 1 };

const show = (node: JSX.Element, path: string, route: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={node} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const fromUnit = `back=${encodeURIComponent('/master-data/units/u1')}`;
const pagesRow = () => screen.getByRole('navigation', { name: 'Pages of this setup area' });

// SETUP_UX_FIXES Phase 3: a record opened from a unit (or the hierarchy) returns there, and the area tab row stays
describe('asset and unit pages return to where they were opened', () => {
  beforeEach(() => {
    actAs('SuperAdmin');
    stubV2Fetch((call) => {
      if (call.url.pathname === '/api/v2/assets/a1') return jsonResponse(200, ASSET);
      if (call.url.pathname === '/api/v2/assets') return jsonResponse(200, listPage([ASSET]));
      return undefined;
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('"Add asset" of a unit: Back and Cancel return to the unit; the tab row highlights Assets', () => {
    show(<AssetDetailPage />, `/master-data/assets/new?unitId=u1&${fromUnit}`, '/master-data/assets/new');
    expect(screen.getByTestId('page-back')).toHaveAttribute('href', '/master-data/units/u1');
    expect(screen.getByTestId('page-back')).toHaveTextContent('Back to Production unit');
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/master-data/units/u1');
    expect(within(pagesRow()).getByRole('link', { current: 'page' })).toHaveTextContent('Assets');
  });

  it('without an origin the asset page goes back to the asset list', () => {
    show(<AssetDetailPage />, '/master-data/assets/new', '/master-data/assets/new');
    expect(screen.getByTestId('page-back')).toHaveAttribute('href', '/master-data/assets');
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/master-data/assets');
  });

  it('the unit page hands its address to "Add asset" and to the asset links', async () => {
    show(<UnitAssetsSection unitId="u1" canAdd />, '/master-data/units/u1', '/master-data/units/:unitId');
    expect(screen.getByRole('link', { name: 'Add asset' })).toHaveAttribute('href', `/master-data/assets/new?unitId=u1&${fromUnit}`);
    expect(await screen.findByRole('link', { name: 'Gearbox' })).toHaveAttribute('href', `/master-data/assets/a1?${fromUnit}`);
  });

  it('the plant hierarchy hands its address to "Add unit", like its asset adds', () => {
    const organization = { id: 'o1', code: 'MAR', name: 'Marun' };
    const plant = { id: 't1', code: 'HDPE', name: 'Marun HDPE', organizationId: 'o1', canEdit: false };
    show(
      <ul><PlantNode organization={organization} plant={plant} acting level={0} canWrite onSwitch={() => undefined} /></ul>,
      '/master-data/hierarchy',
      '/master-data/hierarchy',
    );
    expect(screen.getByRole('link', { name: 'Add unit to Marun HDPE' })).toHaveAttribute('href', `/master-data/units/new?back=${encodeURIComponent('/master-data/hierarchy')}`);
  });

  it('"Add unit" in the plant hierarchy returns to the hierarchy', () => {
    show(<UnitDetailPage />, `/master-data/units/new?back=${encodeURIComponent('/master-data/hierarchy')}`, '/master-data/units/new');
    expect(screen.getByTestId('page-back')).toHaveAttribute('href', '/master-data/hierarchy');
    expect(screen.getByTestId('page-back')).toHaveTextContent('Back to Plant hierarchy');
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/master-data/hierarchy');
  });
});
