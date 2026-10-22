import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { actAs } from '@/test/acting-user';
import { errorBody, jsonResponse, listPage, stubV2Fetch } from '@/test/v2-fetch';

const toast = vi.fn();
const selection = {
  organization: { id: 'o1', code: 'OWN', name: 'Own organization' },
  tenant: { id: 'tenant-a', code: 'P1', name: 'Own plant', organizationId: 'o1' },
};
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection, setSelection: vi.fn(), loading: false }) }));

const { UnitDetailPage } = await import('../units/unit-detail-page');
const { CauseDialog } = await import('../rca/cause-dialog');

const UNIT = {
  id: 'u1', code: 'EXT-1', name: 'Extruder 1', siteId: null, siteName: null, description: null, unitOfMeasure: 't', capacity: null,
  idealCycleTimeSeconds: null, retiredAt: null, rowVersion: 2, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
};
const CODE_TAKEN = { ...errorBody('MASTER_DATA_CODE_EXISTS', 'code exists'), fieldErrors: [{ field: 'code', message: 'code exists' }] };

let postReply = () => jsonResponse(201, { ...UNIT, id: 'u9', code: 'EXT-9', name: 'Extruder 9', rowVersion: 1 });

function stubServer() {
  return stubV2Fetch((call) => {
    const path = call.url.pathname;
    if (call.method === 'POST' && path === '/api/v2/units') return postReply();
    if (call.method === 'POST' && path === '/api/v2/rca-causes') return jsonResponse(201, { id: 'c1', code: 'C1', name: 'Wear', category: 'Equipment', rowVersion: 1 });
    if (call.method === 'PATCH' && path === '/api/v2/units/u1') return jsonResponse(200, { ...UNIT, description: 'Edited', rowVersion: 3 });
    if (path === '/api/v2/units/u1') return jsonResponse(200, UNIT);
    if (path === '/api/v2/organizations' || path === '/api/v2/tenants' || path === '/api/v2/sites') return jsonResponse(200, listPage([]));
    return undefined;
  });
}

const show = (path: string, route = '/master-data/units/new') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={<UnitDetailPage />} />
          <Route path="*" element={<p>Elsewhere</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const createUnit = () => {
  show('/master-data/units/new');
  fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Extruder 9' } });
  fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: 'EXT-9' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create' }));
};

describe('useRecordEditor save feedback (DECISIONS 2026-10-22)', () => {
  beforeEach(() => {
    actAs('SuperAdmin');
    toast.mockReset();
    postReply = () => jsonResponse(201, { ...UNIT, id: 'u9', code: 'EXT-9', name: 'Extruder 9', rowVersion: 1 });
    stubServer();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('ends a create in the result dialog: View, Add another, Back to list, Next', async () => {
    createUnit();
    const dialog = await screen.findByRole('dialog', { name: 'Unit created' });
    expect(within(dialog).getByText('Extruder 9 (EXT-9)')).toBeTruthy();
    expect(within(dialog).getByRole('link', { name: 'View unit' }).getAttribute('href')).toBe('/master-data/units/u9');
    expect(within(dialog).getByRole('link', { name: 'Back to Production units' }).getAttribute('href')).toBe('/master-data/units');
    const next = within(dialog).getByRole('link', { name: 'Next: Assets' });
    expect(next.getAttribute('href')).toBe('/master-data/assets');
    expect(document.activeElement).toBe(next);
    expect(toast).not.toHaveBeenCalled();
  });

  it('"Add another" empties the form and stays on the create page', async () => {
    createUnit();
    const dialog = await screen.findByRole('dialog', { name: 'Unit created' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add another' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('heading', { level: 1, name: 'Create production unit' })).toBeTruthy();
  });

  it('dismissing the dialog opens the new record instead of leaving a second Create possible', async () => {
    createUnit();
    const dialog = await screen.findByRole('dialog', { name: 'Unit created' });
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(await screen.findByText('Elsewhere')).toBeTruthy();
  });

  it('shows a refusal as one red alert with the field marked, and keeps the input', async () => {
    postReply = () => jsonResponse(409, CODE_TAKEN);
    createUnit();
    const alert = await screen.findByTestId('save-failure-alert');
    expect(alert.querySelector('[data-code="MASTER_DATA_CODE_EXISTS"]')).toBeTruthy();
    expect(screen.getAllByText(/This code is already used/).length).toBeGreaterThan(0);
    expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe('Extruder 9');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(toast).not.toHaveBeenCalled();
  });

  it('ends an edit in a toast with the form clean again', async () => {
    show('/master-data/units/u1', '/master-data/units/:unitId');
    const description = await screen.findByLabelText(/^Description/);
    fireEvent.change(description, { target: { value: 'Edited' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'Unit updated successfully' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled());
    expect(screen.getByText('No changes to save.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps a toast and closes for dialogs without a page of their own (RCA cause)', async () => {
    const onClose = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <CauseDialog cause={null} parent={null} onClose={onClose} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: 'C1' } });
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Wear' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast).toHaveBeenCalledWith({ title: 'Cause created successfully' });
  });
});
