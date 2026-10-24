import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/features/ux-kit/use-plant-timezone', () => ({ usePlantTimezone: () => ({ timezone: 'Asia/Tehran', source: 'tenant', loading: false }) }));

const { AdminPage } = await import('./admin-page');
const { AttributeFormPage } = await import('./attributes/attribute-form-page');

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const list = (items: unknown[]) => ({ items, nextCursor: null, asOf: '2026-10-12T00:00:00Z', scope: { tenantId: 'tenant-a' } });

const BRANDING = { appName: 'Traverse Forge', appSubtitle: 'Loss accounting', logoInitials: 'TF', primaryColor: '#2563eb', secondaryColor: '#ec4899', logoSize: 32, isStored: true, updatedAt: null };
const PLANT = { id: 'tenant-a', name: 'HDPE plant', code: 'HDPE', organizationName: 'Marun', timezone: 'Asia/Tehran', calendarSystem: 'gregorian', digits: 'latin', weekStart: 'saturday' };
const ATTRIBUTE = {
  id: 'a1', entityType: 'Unit', name: 'room', displayName: 'Room', description: null, dataType: 'string', isRequired: true, defaultValue: null,
  validationRules: { minLength: null, maxLength: 20, minValue: null, maxValue: null, pattern: null }, selectOptions: [], displayOrder: 1,
  isActive: true, scope: 'plant', editable: true, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
};

function route(path: string) {
  if (path === '/api/v2/branding') return BRANDING;
  if (path === '/api/v2/tenants/tenant-a') return PLANT;
  if (path === '/api/v2/custom-attribute-definitions') return list([ATTRIBUTE]);
  if (path === '/api/v2/custom-attribute-definitions/a1') return ATTRIBUTE;
  if (path === '/api/v2/custom-attribute-definitions/a2') return { ...ATTRIBUTE, id: 'a2', editable: false };
  return list([]);
}

let client: QueryClient;
const wrap = (node: ReactNode, path: string, pattern = '*') =>
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={pattern} element={node} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => json(route(new URL(url).pathname))));
  vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn(); });
  configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  actAs('SuperAdmin');
});
afterEach(() => {
  vi.unstubAllGlobals();
  actAs('SuperAdmin');
});

describe('Admin panel cleanup (25 Oct 2026)', () => {
  it('has no page description; custom attributes are a card with ⓘ, a labelled h-9 Level filter and Add attribute', async () => {
    wrap(<AdminPage />, '/admin');
    expect(await screen.findByText('Room')).toBeTruthy();
    expect(screen.queryByText(/Custom attributes, branding, status automation and plant settings/)).toBeNull();
    expect(screen.queryByText(/Extra fields of organizations, plants, units and assets/)).toBeNull();
    expect(screen.getByRole('button', { name: 'About Custom attributes' })).toBeTruthy();
    expect(screen.getByText('Level', { selector: 'label' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Add attribute/ })).toHaveAttribute('href', '/admin/attributes/new?level=Unit');
    expect(screen.getByRole('link', { name: 'User management' })).toHaveAttribute('href', '/users');
  });

  it('branding: hints behind ⓘ, fields kept; the Reset confirm opens and Esc closes it', async () => {
    wrap(<AdminPage />, '/admin?tab=branding');
    expect(await screen.findByLabelText(/Subtitle/)).toHaveValue('Loss accounting');
    expect(screen.queryByText('Leave empty for none.')).toBeNull();
    expect(screen.queryByText(/Shown when there is no logo/)).toBeNull();
    expect(screen.queryByText('Buttons, links and the logo frame use it.')).toBeNull();
    expect(screen.getByRole('button', { name: 'About Branding' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Reset the branding?' });
    expect(within(confirm).getByRole('button', { name: 'Reset branding' })).toBeTruthy();
    fireEvent.keyDown(confirm, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('status automation: one card, the explanation behind ⓘ, the link to the rules', async () => {
    wrap(<AdminPage />, '/admin?tab=automation');
    const card = await screen.findByTestId('status-rules-moved');
    expect(within(card).queryByText(/are no longer written as code/)).toBeNull();
    expect(within(card).getByRole('link', { name: 'Open the rules' })).toHaveAttribute('href', '/master-data/codes-rules?tab=rules');
  });

  it('plant settings: cards with ⓘ, no "Settings of" line, preview without the zone suffix', async () => {
    wrap(<AdminPage />, '/admin?tab=settings');
    expect(await screen.findByTestId('save-week-start')).toBeTruthy();
    expect(screen.queryByText(/Settings of HDPE plant/)).toBeNull();
    expect(screen.queryByText(/Applies to every screen and PDF export/)).toBeNull();
    expect(screen.getByRole('button', { name: 'About Date and number display' })).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('radio', { name: /Saturday/ })).toBeChecked());
    expect(screen.getByTestId('calendar-preview').textContent).not.toMatch(/Asia\/Tehran|\+03:30/);
    expect(screen.getByTestId('plant-timezone')).toHaveTextContent('Asia/Tehran');
  });

  it('plant settings read-only (viewer of operations): values as text, no disabled radios, no Save', async () => {
    actAs('Engineer');
    wrap(<AdminPage />, '/admin?tab=settings');
    expect(await screen.findByTestId('calendar-settings-read-only')).toHaveTextContent('Gregorian');
    await waitFor(() => expect(screen.getByTestId('week-start-value')).toHaveTextContent('Saturday'));
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  });

  it('attribute page: cards; Delete attribute confirm opens; a read-only user sees the values as text', async () => {
    const first = wrap(<AttributeFormPage />, '/admin/attributes/a1', '/admin/attributes/:attributeId');
    expect(await screen.findByRole('heading', { name: 'Field', level: 2 })).toBeTruthy();
    expect(screen.queryByText('What a value must look like.')).toBeNull();
    expect(screen.queryByText('The label people see in forms.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Delete attribute/ }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete Room?' });
    fireEvent.keyDown(confirm, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());

    first.unmount();
    // shared with other plants: only a super administrator of that scope changes it
    wrap(<AttributeFormPage />, '/admin/attributes/a2', '/admin/attributes/:attributeId');
    const facts = await screen.findByTestId('attribute-read-only');
    expect(within(facts).getByText('room')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
  });
});
