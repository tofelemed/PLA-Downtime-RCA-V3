import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { actAs } from '@/test/acting-user';
import { jsonResponse, listPage, stubV2Fetch } from '@/test/v2-fetch';

const selection = { tenant: { id: 'tenant-a', code: 'P1', name: 'Own plant', organizationId: 'o1' } };
vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection, setSelection: vi.fn(), loading: false }) }));

const { PlantsPage } = await import('./plants-page');
const { PlantNewPage, PlantEditPage } = await import('./hierarchy-form-page');

const ORG = { id: 'o1', code: 'OWN', name: 'Own organization', canAddPlants: true, canDelete: true, canEdit: true, rowVersion: 1 };
const PLANT = {
  id: 'tenant-a', code: 'P1', name: 'Own plant', description: null, organizationId: 'o1', organizationName: 'Own organization', timezone: 'Asia/Tehran',
  calendarSystem: 'gregorian', weekStart: 'saturday', digits: 'latn', canEdit: true, canDelete: true, timezoneEditable: true, rowVersion: 2,
};
const SITE = { id: 's-main', name: 'Main site', timezone: 'Asia/Tehran', operationalDayStart: '06:00', isDefault: true, unitCount: 3 };

const show = (path: string, route: string, node: JSX.Element) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={node} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

// Organizations & plants cleanup (25 Oct 2026)
describe('Organizations & plants', () => {
  beforeEach(() => {
    actAs('SuperAdmin');
    stubV2Fetch((call) => {
      const path = call.url.pathname;
      if (path === '/api/v2/organizations') return jsonResponse(200, listPage([ORG]));
      if (path === '/api/v2/tenants') return jsonResponse(200, listPage([PLANT]));
      if (path === '/api/v2/tenants/tenant-a') return jsonResponse(200, PLANT);
      if (path === '/api/v2/sites') return jsonResponse(200, listPage([SITE]));
      return undefined;
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  const page = () => show('/setup/plants', '/setup/plants', <PlantsPage />);

  it('has no header or card descriptions: three report-look cards with ⓘ, the add actions kept', async () => {
    page();
    await screen.findByRole('row', { name: /Main site/ });
    expect(screen.queryByText(/Companies, the plants they own/)).toBeNull();
    expect(screen.queryByText('Companies that own plants.')).toBeNull();
    expect(screen.queryByText(/Plants you administer/)).toBeNull();
    expect(screen.queryByText(/Units are placed on a site/)).toBeNull();
    for (const [id, title] of [['organizations-card', 'Organizations'], ['plants-card', 'Plants'], ['sites-card', 'Sites of Own plant']]) {
      const card = screen.getByTestId(id);
      expect(card).toHaveClass('rounded-lg', 'border', 'bg-card', 'p-4');
      expect(within(card).getByRole('button', { name: `About ${title}` })).toBeTruthy();
    }
    expect(within(screen.getByTestId('sites-card')).getByTestId('record-list-count')).toHaveTextContent('1');
    expect(screen.getByRole('link', { name: 'Add organization' })).toHaveAttribute('href', '/setup/plants/organizations/new');
    expect(within(screen.getByTestId('plants-card')).getByRole('link', { name: 'Add plant' })).toHaveAttribute('href', '/setup/plants/new');
    expect(screen.getByRole('button', { name: 'Add site' })).toHaveClass('h-9');
    expect(within(screen.getByRole('row', { name: /Main site/ })).getByText('Default')).toHaveClass('whitespace-nowrap');
  });

  it('Delete plant opens its 420 px confirmation, which Cancel closes', async () => {
    page();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete plant Own plant' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete plant Own plant?' });
    expect(dialog).toHaveClass('sm:max-w-[420px]');
    expect(within(dialog).getByText(/Only an empty plant/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('Delete organization opens its confirmation', async () => {
    page();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete organization Own organization' }));
    expect(await screen.findByRole('alertdialog', { name: 'Delete organization Own organization?' })).toBeTruthy();
  });

  it('Add site dialog: what empty fields mean behind ⓘ, 420 px, focus in Name, h-9, Esc closes', async () => {
    page();
    fireEvent.click(await screen.findByRole('button', { name: 'Add site' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add site to Own plant' });
    expect(dialog).toHaveClass('sm:max-w-[420px]');
    expect(within(dialog).queryByText(/Leave time zone and day start empty/)).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'About Add site to Own plant' })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByLabelText(/^Name/)));
    expect(within(dialog).getByRole('form', { name: 'Add site' })).toHaveClass('[&_input]:h-9');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('Rename site dialog: name only, focus in Name', async () => {
    page();
    fireEvent.click(await screen.findByRole('button', { name: 'Rename site Main site' }));
    const dialog = await screen.findByRole('dialog', { name: 'Rename Main site' });
    expect(within(dialog).queryByText(/only the name changes/)).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByLabelText(/^Name/)));
    expect(within(dialog).queryByLabelText(/^Time zone/)).toBeNull();
  });

  it('Add plant page has no description', async () => {
    show('/setup/plants/new', '/setup/plants/new', <PlantNewPage />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Add plant' })).toBeTruthy();
    expect(screen.queryByText('A plant is a site with its own users, units and data.')).toBeNull();
  });

  it('Edit plant: the kind is a badge on the title line; no footer note about Plant & equipment', async () => {
    show('/setup/plants/tenant-a/edit', '/setup/plants/:plantId/edit', <PlantEditPage />);
    const title = await screen.findByRole('heading', { level: 1, name: 'Edit Own plant' });
    expect(title.parentElement).toHaveTextContent('Plant');
    expect(screen.queryByText(/they act on the selected plant/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy();
  });
});
