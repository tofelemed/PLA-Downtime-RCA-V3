import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { actAs } from '@/test/acting-user';
import { jsonResponse, listPage, stubV2Fetch } from '@/test/v2-fetch';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/api/v2/queries/use-v2-tenant', () => ({ useV2TenantId: () => 'tenant-a' }));

const REFS = {
  timezone: 'Asia/Tehran',
  timezoneIsFallback: false,
  unitOptions: [{ value: 'u1', label: 'Unit 1' }],
  productOptions: [{ value: 'p1', label: 'HDPE (P1)' }],
  siteOptions: [],
  defaultSiteId: 's1',
  unitName: () => 'Unit 1',
  productName: () => 'HDPE',
  loading: false,
};
vi.mock('../hooks/use-planning-refs', () => ({ usePlanningRefs: () => REFS }));

const { PlanningPage } = await import('../planning-page');
const { ProfilePage } = await import('./profile-page');
const { NewProfilePage } = await import('./profile-editor-page');
const { RateImportPage } = await import('./rate-import-page');

const PROFILE = {
  id: 'pr1', unitId: 'u1', productId: 'p1', operatingMode: 'normal', quantityUom: 't', rateTimebase: 'h', capacityModel: 'single_stream', version: 1, state: 'approved',
  effectiveFrom: '2026-10-17T02:30:00.000Z', effectiveTo: null, rowVersion: 1, createdBy: 'someone-else',
};
const RATE = { id: 'r1', profileId: 'pr1', rateKind: 'sustained', version: 1, rate: '10', ratePerSecond: '0.00277778', timebase: 'h', source: 'manual', state: 'draft', effectiveFrom: '2026-10-17T02:30:00.000Z', effectiveTo: null, createdBy: 'someone-else' };
const STREAM = { id: 's1', unitId: 'u1', code: 'T1', name: 'Train 1', capacityShare: '0.5', version: 1, state: 'approved', effectiveFrom: '2026-10-17T02:30:00.000Z', effectiveTo: null, createdBy: 'x' };

function open(at: string) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route path="/setup/profiles" element={<PlanningPage view="profiles" />} />
          <Route path="/planning/profiles/new" element={<NewProfilePage />} />
          <Route path="/planning/profiles/import" element={<RateImportPage />} />
          <Route path="/planning/profiles/:profileId" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const footerLabels = (dialog: HTMLElement) => within(within(dialog).getByTestId('form-buttons')).getAllByRole('button').map((b) => b.textContent);

/** The entry dialog contract: ⓘ instead of a description, first field focused, Cancel then the primary, Esc closes. */
async function expectFormDialog(name: string, primary: string, gone: RegExp) {
  const dialog = await screen.findByRole('dialog', { name });
  expect(within(dialog).queryByText(gone)).toBeNull();
  expect(within(dialog).getByRole('button', { name: 'About this entry' })).toBeInTheDocument();
  await waitFor(() => expect(dialog.contains(document.activeElement) && document.activeElement?.tagName).toMatch(/INPUT|SELECT|TEXTAREA/));
  expect(footerLabels(dialog)).toEqual(['Cancel', primary]);
  fireEvent.keyDown(dialog, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
}

describe('Profiles & rates cleanup', () => {
  beforeEach(() => {
    actAs('SuperAdmin');
    stubV2Fetch((call) => {
      if (call.method !== 'GET') return undefined;
      const path = call.url.pathname;
      if (path.endsWith('/profiles/pr1')) return jsonResponse(200, PROFILE);
      if (path.endsWith('/profiles/pr1/rates')) return jsonResponse(200, listPage([RATE]));
      if (path.endsWith('/profiles')) return jsonResponse(200, listPage([PROFILE]));
      if (path.endsWith('/unit-streams')) return jsonResponse(200, listPage([STREAM]));
      return undefined;
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('list: the rates note is an ⓘ beside the title; Import rates and New profile beside the title; a titled card without zone suffixes', async () => {
    open('/setup/profiles');
    await screen.findByTestId('profile-row');
    expect(screen.queryByText(/Rates are entered in/)).toBeNull();
    expect(screen.getByTestId('decision-banner')).toHaveAttribute('data-decision', 'valuation');
    const header = screen.getByRole('heading', { level: 1 }).closest('header');
    expect(header?.querySelector('[data-testid="profile-new"]')).toBeTruthy();
    expect(header?.querySelector('[data-testid="rate-import"]')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Production profiles' })).toBeInTheDocument();
    expect(screen.getByTestId('profiles-tab').textContent).not.toMatch(/Asia\/Tehran|\+03:30/);
    expect(screen.getByLabelText('Unit')).toHaveClass('h-9');
  });

  it('grade transitions: a centred empty state until a unit is chosen; Add transition standard beside the title opens its dialog', async () => {
    open('/setup/profiles?tab=transitions');
    expect(await screen.findByText('No unit chosen')).toBeInTheDocument();
    expect(screen.queryByTestId('transition-standard-new')).toBeNull();
    fireEvent.change(screen.getByLabelText('Unit'), { target: { value: 'u1' } });
    expect(await screen.findByRole('heading', { level: 2, name: 'Grade-transition standards' })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('transition-standard-new'));
    await expectFormDialog('Add transition standard', 'Add draft standard', /another manager approves it/);
  });

  it('streams: Streams and Stream runs cards; Add stream and Record run dialogs follow the dialog rules', async () => {
    open('/setup/profiles?tab=streams&unitId=u1');
    await screen.findByTestId('unit-stream-row');
    expect(screen.getByRole('heading', { level: 2, name: 'Streams' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Stream runs' })).toBeInTheDocument();
    expect(screen.getByTestId('unit-streams-tab').textContent).not.toMatch(/Asia\/Tehran|\+03:30/);
    fireEvent.click(screen.getByTestId('unit-stream-new'));
    await expectFormDialog('Add stream', 'Add draft stream', /another manager approves it/);
    await waitFor(() => expect(screen.getByRole('button', { name: /Record run/ })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /Record run/ }));
    await expectFormDialog('Record stream run', 'Record run', /the lot it made/);
  });

  it('profile page: no zone suffixes; Add rate version and Add valuation rate dialogs follow the dialog rules; Retire asks first', async () => {
    open('/planning/profiles/pr1');
    await screen.findByTestId('profile-detail');
    await screen.findByTestId('rate-row');
    expect(screen.getByTestId('profile-detail').textContent).not.toMatch(/Asia\/Tehran|\+03:30/);
    fireEvent.click(screen.getByTestId('rate-add'));
    await expectFormDialog('Add rate version', 'Add draft rate', /another manager approves it/);
    fireEvent.click(screen.getByTestId('valuation-rate-add'));
    await expectFormDialog('Add valuation rate', 'Add draft valuation rate', /another person approves it/);
    fireEvent.click(within(screen.getByTestId('rate-row')).getByRole('button', { name: 'Retire' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Retire this rate version?' });
    expect(within(confirm).getAllByRole('button').map((b) => b.textContent)).toEqual(['Cancel', 'Retire rate version']);
  });

  it('new profile and rate import pages: no description lines or field hints; the notes are behind an ⓘ', async () => {
    const { unmount } = open('/planning/profiles/new');
    await screen.findByRole('heading', { level: 1, name: 'New profile version' });
    expect(screen.queryByText(/a manager approver approves it/)).toBeNull();
    expect(screen.queryByText(/Unit of every rate of this profile/)).toBeNull();
    expect(screen.getByRole('button', { name: 'About New profile version' })).toBeInTheDocument();
    unmount();
    open('/planning/profiles/import');
    await screen.findByRole('heading', { level: 1, name: 'Import rates' });
    expect(screen.queryByText(/Budget, forecast or MPC rates from a CSV file/)).toBeNull();
    expect(screen.queryByText(/is a correction/)).toBeNull();
    expect(screen.getByRole('button', { name: 'About the rate file' })).toBeInTheDocument();
    expect(screen.getByTestId('rate-import-submit')).toBeInTheDocument();
  });
});
