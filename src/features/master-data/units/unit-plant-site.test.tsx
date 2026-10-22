import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { actAs } from '@/test/acting-user';
import { jsonResponse, listPage, stubV2Fetch, type V2Call } from '@/test/v2-fetch';

const setSelection = vi.fn();
const selection = {
  organization: { id: 'o1', code: 'OWN', name: 'Own organization' },
  tenant: { id: 'tenant-a', code: 'P1', name: 'Own plant', organizationId: 'o1' },
};
vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection, setSelection, loading: false }) }));

const { UnitDetailPage } = await import('./unit-detail-page');
const { AssetDetailPage } = await import('../assets/asset-detail-page');
const { ProductDetailPage } = await import('../products/product-detail-page');

const ORGS = [{ id: 'o1', code: 'OWN', name: 'Own organization' }, { id: 'o2', code: 'SEC', name: 'Second organization' }];
const PLANTS = [
  { id: 'tenant-a', code: 'P1', name: 'Own plant', organizationId: 'o1' },
  { id: 'tenant-b', code: 'P2', name: 'Plant B', organizationId: 'o2' },
];
const SITES = [
  { id: 's-main', name: 'Main site', timezone: 'Asia/Tehran', operationalDayStart: '06:00', isDefault: true, unitCount: 3 },
  { id: 's-north', name: 'North yard', timezone: 'Asia/Tehran', operationalDayStart: '07:00', isDefault: false, unitCount: 0 },
];
const UNIT = {
  id: 'u1', code: 'EXT-1', name: 'Extruder 1', siteId: null, siteName: 'Main site', description: null, unitOfMeasure: 't', capacity: null,
  idealCycleTimeSeconds: null, retiredAt: null, rowVersion: 2, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
};

describe('plant and site on master-data forms (Setup UX Phase 1)', () => {
  let calls: V2Call[];
  const scrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');

  const show = (node: JSX.Element, path: string, route: string) =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={route} element={node} />
            <Route path="*" element={<p>Elsewhere</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

  const choose = async (label: RegExp | string, option: string) => {
    fireEvent.click(screen.getByRole('combobox', { name: label }));
    fireEvent.click(await screen.findByRole('option', { name: option }));
  };

  beforeEach(() => {
    actAs('SuperAdmin');
    setSelection.mockReset();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
    calls = stubV2Fetch((call) => {
      const path = call.url.pathname;
      if (call.method === 'POST' && path === '/api/v2/units') return jsonResponse(201, { ...UNIT, id: 'u9' });
      if (call.method === 'PATCH' && path === '/api/v2/units/u1') return jsonResponse(200, { ...UNIT, siteId: 's-north', rowVersion: 3 });
      if (path === '/api/v2/organizations') return jsonResponse(200, listPage(ORGS));
      if (path === '/api/v2/tenants') return jsonResponse(200, listPage(PLANTS));
      if (path === '/api/v2/sites') return jsonResponse(200, listPage(SITES));
      if (path === '/api/v2/units/u1') return jsonResponse(200, UNIT);
      return undefined;
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    if (scrollIntoView) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scrollIntoView);
    else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  });

  it('switches the selected plant from the create form only after a confirmation', async () => {
    show(<UnitDetailPage />, '/master-data/units/new', '/master-data/units/new');
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Plant' })).toHaveTextContent('Own plant'));
    await choose('Plant', 'Plant B');
    const dialog = await screen.findByRole('alertdialog', { name: 'Switch the selected plant to Plant B?' });
    expect(within(dialog).getByText('The record will be created in Plant B and the whole app switches to Plant B.')).toBeTruthy();
    expect(setSelection).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Switch to Plant B' }));
    expect(setSelection).toHaveBeenCalledWith({ organization: ORGS[1], tenant: PLANTS[1] });
  });

  it('cancelling the switch keeps the plant', async () => {
    show(<AssetDetailPage />, '/master-data/assets/new', '/master-data/assets/new');
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Plant' })).toHaveTextContent('Own plant'));
    await choose('Plant', 'Plant B');
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
    expect(setSelection).not.toHaveBeenCalled();
  });

  it('creates a unit on the chosen site and on the default site as null', async () => {
    show(<UnitDetailPage />, '/master-data/units/new', '/master-data/units/new');
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Extruder 2' } });
    fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: 'EXT-2' } });
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Site' })).toHaveTextContent('Main site (default)'));
    await choose('Site', 'North yard');
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(calls.some((call) => call.method === 'POST')).toBe(true));
    expect(calls.find((call) => call.method === 'POST')?.body).toMatchObject({ code: 'EXT-2', name: 'Extruder 2', siteId: 's-north' });
  });

  it('shows the plant read-only on an edit page and sends a changed site only', async () => {
    show(<UnitDetailPage />, '/master-data/units/u1', '/master-data/units/:unitId');
    await screen.findByRole('combobox', { name: 'Site' });
    expect(screen.queryByRole('combobox', { name: 'Plant' })).toBeNull();
    expect(screen.getByText('Own organization › Own plant')).toBeTruthy();
    await choose('Site', 'North yard');
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(calls.some((call) => call.method === 'PATCH')).toBe(true));
    expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({ siteId: 's-north' });
  });

  it('offers the plant on the product create form too', async () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    show(<ProductDetailPage />, '/master-data/products/new', '/master-data/products/new');
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Plant' })).toHaveTextContent('Own plant'));
  });
});
