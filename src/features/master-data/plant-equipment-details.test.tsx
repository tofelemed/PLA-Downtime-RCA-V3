import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { actAs } from '@/test/acting-user';
import { jsonResponse, listPage, stubV2Fetch } from '@/test/v2-fetch';

const selection = {
  organization: { id: 'o1', code: 'OWN', name: 'Own organization' },
  tenant: { id: 'tenant-a', code: 'P1', name: 'Own plant', organizationId: 'o1' },
};
/** read-only master-data users (the plant administrators without a master-data writer role) */
const writer = vi.hoisted(() => ({ value: true }));
const retiredUnit = vi.hoisted(() => ({ value: false }));
vi.mock('./hooks/use-master-data-writer', () => ({ useMasterDataWriter: () => writer.value }));
vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection, setSelection: vi.fn(), loading: false }) }));

const { UnitDetailPage } = await import('./units/unit-detail-page');
const { AssetDetailPage } = await import('./assets/asset-detail-page');
const { ProductDetailPage } = await import('./products/product-detail-page');

const UNIT = {
  id: 'u1', code: 'EXT-1', name: 'Extruder 1', siteId: null, siteName: 'Main site', description: 'Main line', unitOfMeasure: 't', capacity: null,
  idealCycleTimeSeconds: null, retiredAt: null, rowVersion: 2, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
};
const ASSET = { id: 'a1', code: 'GB-1', name: 'Gearbox', unitId: 'u1', description: null, assetType: 'Equipment', criticality: 'High', status: null, retiredAt: null, rowVersion: 1 };
const PRODUCT = { id: 'p1', code: 'HD5502', name: 'HDPE grade A', uom: 't', description: null, availability: 'organization', isActive: true, legacyStandardCost: null, rowVersion: 1 };
const SITES = [{ id: 's-main', name: 'Main site', timezone: 'Asia/Tehran', operationalDayStart: '06:00', isDefault: true, unitCount: 1 }];
const DEFINITION = {
  id: 'd1', entityType: 'Unit', name: 'room', displayName: 'Room', description: 'Where the unit stands.', dataType: 'text', isRequired: false,
  defaultValue: null, validationRules: {}, selectOptions: [], isActive: true,
};

const show = (node: JSX.Element, path: string, route: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={node} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('Plant & equipment record pages (cleanup 25 Oct 2026)', () => {
  beforeEach(() => {
    actAs('SuperAdmin');
    writer.value = true;
    retiredUnit.value = false;
    stubV2Fetch((call) => {
      const path = call.url.pathname;
      if (path === '/api/v2/units/u1') return jsonResponse(200, UNIT);
      // a retired unit is listed only when retired units are asked for
      if (path === '/api/v2/units') {
        const status = call.url.searchParams.get('status');
        if (retiredUnit.value) return jsonResponse(200, listPage(status === 'active' ? [] : [{ ...UNIT, retiredAt: '2026-10-10T00:00:00Z' }]));
        return jsonResponse(200, listPage([UNIT]));
      }
      if (path === '/api/v2/assets/a1') return jsonResponse(200, ASSET);
      if (path === '/api/v2/products/p1') return jsonResponse(200, PRODUCT);
      if (path === '/api/v2/sites') return jsonResponse(200, listPage(SITES));
      if (path === '/api/v2/custom-attribute-definitions') return jsonResponse(200, listPage([DEFINITION]));
      if (path === '/api/v2/custom-attribute-values') return jsonResponse(200, []);
      return undefined;
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('unit: the status badge sits on the title line; the site and plant explanations are behind ⓘ', async () => {
    show(<UnitDetailPage />, '/master-data/units/u1', '/master-data/units/:unitId');
    const title = await screen.findByRole('heading', { level: 1, name: 'Extruder 1' });
    expect(title.parentElement).toHaveTextContent('Active');
    expect(screen.queryByText(/The site sets the unit’s time zone/)).toBeNull();
    expect(screen.getByRole('button', { name: 'About Site' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Assets of this unit' }).closest('section')).toHaveClass('rounded-lg', 'border', 'bg-card');
    expect(screen.queryByText(/Kept from the previous version/)).toBeNull();
    expect(screen.getByRole('button', { name: 'About Legacy values' })).toBeTruthy();
  });

  it('unit: read-only users see the values as text, not disabled inputs', async () => {
    writer.value = false;
    show(<UnitDetailPage />, '/master-data/units/u1', '/master-data/units/:unitId');
    await screen.findByRole('heading', { level: 1, name: 'Extruder 1' });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(within(screen.getByRole('group', { name: 'Name' })).getByText('Extruder 1')).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Description' })).getByText('Main line')).toBeTruthy();
    await waitFor(() => expect(within(screen.getByRole('group', { name: 'Site' })).getByText('Main site (default)')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Retire unit/ })).toBeNull();
  });

  it('unit: Retire opens its confirmation (420 px), names the action, and Cancel closes it', async () => {
    show(<UnitDetailPage />, '/master-data/units/u1', '/master-data/units/:unitId');
    fireEvent.click(await screen.findByRole('button', { name: 'Retire unit' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Retire Extruder 1?' });
    expect(dialog).toHaveClass('sm:max-w-[420px]');
    expect(within(dialog).getByRole('button', { name: 'Retire unit' })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('unit: a custom attribute opens its edit dialog — ⓘ for the description, focus in the field, h-9, Esc closes', async () => {
    show(<UnitDetailPage />, '/master-data/units/u1', '/master-data/units/:unitId');
    fireEvent.click(await screen.findByRole('button', { name: 'Custom attributes' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Room' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Room' });
    expect(within(dialog).queryByText('Where the unit stands.')).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'About Room' })).toBeTruthy();
    const field = within(dialog).getByLabelText('Room');
    expect(field).toHaveClass('h-9');
    await waitFor(() => expect(document.activeElement).toBe(field));
    const buttons = within(dialog).getAllByRole('button').filter((button) => /Cancel|Save/.test(button.textContent ?? ''));
    expect(buttons.map((button) => button.textContent)).toEqual(['Cancel', 'Save']);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('asset: read-only users see unit and classification as text', async () => {
    writer.value = false;
    show(<AssetDetailPage />, '/master-data/assets/a1', '/master-data/assets/:assetId');
    await screen.findByRole('heading', { level: 1, name: 'Gearbox' });
    expect(screen.queryByRole('combobox')).toBeNull();
    await waitFor(() => expect(within(screen.getByRole('group', { name: 'Production unit' })).getByText('EXT-1 — Extruder 1')).toBeTruthy());
    expect(within(screen.getByRole('group', { name: 'Criticality' })).getByText('High')).toBeTruthy();
  });

  it('product: the organization-wide note and the availability rule are behind ⓘ; "Available to:" stays', async () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    show(<ProductDetailPage />, '/master-data/products/p1', '/master-data/products/:productId');
    await screen.findByRole('heading', { level: 1, name: 'HDPE grade A' });
    expect(screen.queryByText('Changes apply to every plant of the organization.')).toBeNull();
    expect(screen.getByRole('button', { name: 'About Details' })).toBeTruthy();
    expect(screen.getByText('Available to:')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'About Available to' })).toBeTruthy();
  });

  it('asset: read-only, a retired unit is still named', async () => {
    writer.value = false;
    retiredUnit.value = true;
    show(<AssetDetailPage />, '/master-data/assets/a1', '/master-data/assets/:assetId');
    await screen.findByRole('heading', { level: 1, name: 'Gearbox' });
    await waitFor(() => expect(within(screen.getByRole('group', { name: 'Production unit' })).getByText('EXT-1 — Extruder 1')).toBeTruthy());
    expect(screen.queryByText('Unknown unit')).toBeNull();
  });
});
