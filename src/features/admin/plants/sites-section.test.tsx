import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { actAs } from '@/test/acting-user';
import { errorBody, jsonResponse, listPage, stubV2Fetch, type V2Call } from '@/test/v2-fetch';
import { siteCreateOf, validateSite } from './site-form-model';

const selection = { tenant: { id: 'tenant-a', code: 'P1', name: 'Own plant', organizationId: 'o1' } };
vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection, setSelection: vi.fn(), loading: false }) }));

const { SitesSection } = await import('./sites-section');

const MAIN = { id: 's-main', name: 'Main site', timezone: 'Asia/Tehran', operationalDayStart: '06:00', isDefault: true, unitCount: 3 };
const NORTH = { id: 's-north', name: 'North yard', timezone: 'Asia/Dubai', operationalDayStart: '07:00', isDefault: false, unitCount: 0 };

describe('sites of the selected plant (Setup UX Phase 1)', () => {
  let calls: V2Call[];
  let refuse: number | null;

  const show = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><SitesSection /></QueryClientProvider>);
  const commands = () => calls.filter((call) => call.method !== 'GET');

  beforeEach(() => {
    actAs('TenantAdmin');
    refuse = null;
    calls = stubV2Fetch((call) => {
      if (call.method === 'POST' && call.url.pathname === '/api/v2/sites') {
        return refuse ? jsonResponse(refuse, errorBody('DUPLICATE_SITE_NAME', 'taken')) : jsonResponse(201, { ...NORTH, id: 's-new', name: 'South yard' });
      }
      if (call.method === 'PATCH') return jsonResponse(200, { ...NORTH, name: 'North field' });
      if (call.url.pathname === '/api/v2/sites') return jsonResponse(200, listPage([MAIN, NORTH]));
      return undefined;
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin');
  });

  it('lists name, time zone, day start, default and unit count of the acting plant only', async () => {
    show();
    const row = await screen.findByRole('row', { name: /Main site/ });
    expect(within(row).getByText('Default')).toBeTruthy();
    expect(within(row).getByText('Asia/Tehran')).toBeTruthy();
    expect(within(row).getByText('06:00')).toBeTruthy();
    expect(within(row).getByText('3')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Sites of Own plant' })).toBeTruthy();
    expect(calls.filter((call) => call.url.pathname === '/api/v2/sites')[0].headers.get('X-Tenant-Id')).toBe('tenant-a');
  });

  it('adds a site with exactly the entered fields', async () => {
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Add site' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add site to Own plant' });
    fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: ' South yard ' } });
    fireEvent.change(within(dialog).getByLabelText(/^Day start/), { target: { value: '05:30' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add site' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(commands()).toHaveLength(1);
    expect(commands()[0]).toMatchObject({ method: 'POST', body: { name: 'South yard', operationalDayStart: '05:30' } });
    expect(commands()[0].body).not.toHaveProperty('timezone');
  });

  it('marks a duplicate name on the field and keeps the dialog open', async () => {
    refuse = 409;
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Add site' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: 'Main site' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add site' }));
    expect(await within(dialog).findByText('A site with this name already exists in this plant.')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('renames a site with its name only', async () => {
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Rename site North yard' }));
    const dialog = await screen.findByRole('dialog', { name: 'Rename North yard' });
    expect(within(dialog).queryByLabelText(/^Time zone/)).toBeNull();
    fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: 'North field' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rename site' }));
    await waitFor(() => expect(commands()).toHaveLength(1));
    expect(commands()[0]).toMatchObject({ method: 'PATCH', body: { name: 'North field' } });
    expect(commands()[0].url.pathname).toBe('/api/v2/sites/s-north');
  });

  it('is read-only for roles that cannot manage sites', async () => {
    actAs('viewer');
    show();
    await screen.findByRole('row', { name: /North yard/ });
    expect(screen.queryByRole('button', { name: 'Add site' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Rename site/ })).toBeNull();
  });
});

describe('site form model', () => {
  it('requires a name, checks HH:MM and leaves blank optional fields out', () => {
    expect(validateSite({ name: ' ', timezone: '', operationalDayStart: '6' })).toEqual({ name: 'Enter a name.', operationalDayStart: 'Use HH:MM, e.g. 06:00.' });
    expect(siteCreateOf({ name: ' A ', timezone: ' ', operationalDayStart: '' })).toEqual({ name: 'A' });
    expect(siteCreateOf({ name: 'A', timezone: 'Asia/Tehran', operationalDayStart: '06:00' })).toEqual({ name: 'A', timezone: 'Asia/Tehran', operationalDayStart: '06:00' });
  });
});
