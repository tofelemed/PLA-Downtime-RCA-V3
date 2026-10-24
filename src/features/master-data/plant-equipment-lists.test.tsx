import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { actAs } from '@/test/acting-user';
import { jsonResponse, listPage, stubV2Fetch } from '@/test/v2-fetch';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null, setSelection: vi.fn(), loading: false }) }));

const { UnitsPage } = await import('./units/units-page');
const { AssetsPage } = await import('./assets/assets-page');
const { ProductsPage } = await import('./products/products-page');

const UNIT = { id: 'u1', code: 'EXT-1', name: 'Extruder 1', unitOfMeasure: 't', description: null, retiredAt: null };
const ASSET = { id: 'a1', code: 'GB-1', name: 'Gearbox', unitId: 'u1', assetType: 'Equipment', criticality: 'High', retiredAt: null };
const PRODUCT = { id: 'p1', code: 'HD5502', name: 'HDPE grade A', uom: 't', availability: 'plant', isActive: true };

const show = (node: JSX.Element, path: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>
    </QueryClientProvider>,
  );

/** the search box is h-9 through its wrapper (`[&_input]:h-9`) */
const compactSearch = (box: HTMLElement) => expect(box.parentElement).toHaveClass('[&_input]:h-9');
const headers = (name: string) => within(screen.getByRole('table', { name })).getAllByRole('columnheader').map((cell) => cell.textContent);

// Plant & equipment cleanup (25 Oct 2026): no header description, one card per list, one h-9 filter row
describe('Plant & equipment lists', () => {
  let empty = false;
  beforeEach(() => {
    actAs('SuperAdmin');
    empty = false;
    stubV2Fetch((call) => {
      const rows = (row: unknown) => jsonResponse(200, listPage(empty ? [] : [row]));
      if (call.url.pathname === '/api/v2/units') return rows(UNIT);
      if (call.url.pathname === '/api/v2/assets') return rows(ASSET);
      if (call.url.pathname === '/api/v2/products') return rows(PRODUCT);
      return undefined;
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('units: no description, the list in a card with Search, Status and Sort h-9 in one row, Add unit kept', async () => {
    show(<UnitsPage />, '/master-data/units');
    await screen.findByText('Extruder 1');
    expect(screen.queryByText('Lines and units of the selected plant.')).toBeNull();
    const card = screen.getByTestId('units-card');
    expect(within(card).getByRole('heading', { level: 2, name: 'Units' })).toBeTruthy();
    expect(card).toHaveClass('rounded-lg', 'border', 'bg-card', 'p-4');
    compactSearch(within(card).getByRole('searchbox', { name: 'Search units' }));
    expect(within(card).getByRole('combobox', { name: 'Status' })).toHaveClass('h-9');
    expect(within(card).getByRole('combobox', { name: 'Sort' })).toHaveClass('h-9');
    expect(screen.getByRole('link', { name: /Add unit/ })).toHaveAttribute('href', '/master-data/units/new');
  });

  it('units: Status is a column only when active and retired units are listed together', async () => {
    show(<UnitsPage />, '/master-data/units');
    await screen.findByText('Extruder 1');
    expect(headers('Production units')).not.toContain('Status');
  });

  it('units: Status column with "Active and retired"', async () => {
    show(<UnitsPage />, '/master-data/units?status=all');
    await screen.findByText('Extruder 1');
    expect(headers('Production units')).toContain('Status');
  });

  it('units: a search with no match keeps its own empty message', async () => {
    empty = true;
    show(<UnitsPage />, '/master-data/units?q=zzz');
    expect(await screen.findByText('No unit matches the search.')).toBeTruthy();
  });

  it('assets: the unit filter comes first in the row; the Unit column goes once one unit is chosen', async () => {
    show(<AssetsPage />, '/master-data/assets');
    await screen.findByText('Gearbox');
    expect(screen.queryByText('Equipment and instruments of the selected plant, each under a unit.')).toBeNull();
    const card = screen.getByTestId('assets-card');
    const unit = within(card).getByRole('combobox', { name: 'Unit' });
    expect(unit).toHaveClass('h-9');
    const search = within(card).getByRole('searchbox', { name: 'Search assets' });
    expect(unit.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(headers('Assets')).toContain('Unit');
  });

  it('assets: filtered to one unit, no Unit column; Add asset carries the unit', async () => {
    show(<AssetsPage />, '/master-data/assets?unitId=u1');
    await screen.findByText('Gearbox');
    expect(headers('Assets')).not.toContain('Unit');
    expect(screen.getByRole('link', { name: /Add asset/ })).toHaveAttribute('href', '/master-data/assets/new?unitId=u1');
  });

  it('products: the sharing rule moves behind the card ⓘ; availability badges do not wrap', async () => {
    show(<ProductsPage />, '/master-data/products');
    const badge = await screen.findByText('This plant only');
    expect(badge).toHaveClass('whitespace-nowrap');
    expect(screen.queryByText(/Products belong to the organization/)).toBeNull();
    const card = screen.getByTestId('products-card');
    expect(within(card).getByRole('button', { name: 'About Products' })).toBeTruthy();
    compactSearch(within(card).getByRole('searchbox', { name: 'Search products' }));
    expect(screen.getByRole('link', { name: /Add product/ })).toHaveAttribute('href', '/master-data/products/new');
  });
});
