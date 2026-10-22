import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { configureV2Session } from '@/api/v2/config';
import type { ProfileView } from '@/api/v2/types/profiles';

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { RateForm } = await import('./profiles/rate-form');
const { VersionActions } = await import('./profiles/version-actions');
const { ProfileEditor } = await import('./profiles/profile-editor');
const { RateImportPage } = await import('./profiles/rate-import-page');
const { CrewRotationEditor } = await import('./calendars/crew-rotation-editor');
const { CalendarVersionPage } = await import('./calendars/calendar-editor-page');
const { EndRunAction } = await import('./streams/end-run-action');

interface Call {
  method: string;
  path: string;
  body: Record<string, unknown> | null;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const refusal = (code: string, extra: Record<string, unknown> = {}) => ({ code, message: code, correlationId: 'corr-1', retryable: false, ...extra });
const EMPTY = { items: [], nextCursor: null };

const REFS = {
  timezone: 'Asia/Tehran', timezoneIsFallback: false, unitOptions: [{ value: 'u1', label: 'Unit 1' }], productOptions: [{ value: 'p1', label: 'HDPE (P1)' }],
  siteOptions: [], defaultSiteId: null, unitName: () => 'Unit 1', productName: () => 'HDPE', loading: false,
};
const PROFILE = {
  id: 'pr9', unitId: 'u1', productId: 'p1', operatingMode: 'normal', quantityUom: 't', rateTimebase: 'h', capacityModel: 'single_stream', version: 1, state: 'draft',
  effectiveFrom: '2026-10-10T02:30:00.000Z', effectiveTo: null, rowVersion: 1,
} as unknown as ProfileView;
const DRAFT_CALENDAR = {
  id: 'cal-1', version: 3, state: 'draft', siteId: 's1', unitId: null, timezone: 'Asia/Tehran', operationalDayStart: '06:00', effectiveFrom: '2026-10-01',
  effectiveTo: null, shiftTemplates: [{ name: 'A', startLocal: '06:00', endLocal: '18:00', daysOfWeek: [] }], workingIntervals: [], holidays: [], exclusions: [], publishedBy: null, publishedAt: null, republishReason: null, rowVersion: 1,
};

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname}</p>;
}

describe('plans, profiles, calendars — save feedback (DECISIONS 2026-10-22)', () => {
  let calls: Call[];
  let reply: (call: Call) => Response;
  let client: QueryClient;
  const wrap = (node: ReactNode, at = '/form', path = '/form') =>
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[at]}>
          <Where />
          <Routes>
            <Route path={path} element={node} />
            <Route path="*" element={<p>Elsewhere</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    calls = [];
    reply = () => json(200, EMPTY);
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
      const call = { method: init.method ?? 'GET', path: new URL(url).pathname, body: init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null };
      calls.push(call);
      return reply(call);
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    toast.mockReset();
  });

  const posted = () => calls.filter((call) => call.method !== 'GET');

  it('an inline add (rate) ends in a toast and closes; a refusal is one red alert at the top, input kept', async () => {
    const onDone = vi.fn();
    reply = (call) => (call.method === 'POST' ? json(422, refusal('VALIDATION_FAILED', { fieldErrors: [{ field: 'rate', message: 'rate must be positive' }] })) : json(200, EMPTY));
    wrap(<RateForm profileId="pr9" timebase="h" uom="t" timezone="Asia/Tehran" onDone={onDone} />);
    fireEvent.change(screen.getByLabelText('Rate'), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText('Effective from date'), { target: { value: '2026-10-10' } });
    fireEvent.change(screen.getByLabelText('Effective from time'), { target: { value: '06:00' } });
    fireEvent.click(screen.getByTestId('rate-save'));
    const alert = await screen.findByTestId('save-failure-alert');
    expect(within(alert).getByTestId('refusal').getAttribute('data-kind')).toBe('validation');
    expect(screen.getByTestId('rate-form').firstElementChild).toBe(alert);
    expect(screen.getByTestId('field-error-rate').textContent).toMatch(/Must be positive/);
    expect((screen.getByLabelText('Rate') as HTMLInputElement).value).toBe('50');
    expect(onDone).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();

    reply = (call) => (call.method === 'POST' ? json(201, { id: 'r9' }) : json(200, EMPTY));
    fireEvent.click(screen.getByTestId('rate-save'));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(toast).toHaveBeenCalledWith({ title: 'Draft rate version added' });
  });

  it('an approve refusal shows once next to the buttons, never also in the retire dialog; approve success is a toast', async () => {
    reply = () => json(409, refusal('VERSION_OVERLAP', { details: { conflicts: [{ id: 'r0', version: 1, effectiveFrom: '2026-10-01T02:30:00.000Z', effectiveTo: null }] } }));
    wrap(<VersionActions resource="rates" id="r2" state="draft" timezone="Asia/Tehran" />);
    fireEvent.click(screen.getByTestId('approve-version'));
    await waitFor(() => expect(screen.getAllByTestId('refusal')).toHaveLength(1));
    expect(screen.getByTestId('refusal-conflict').textContent).toMatch(/Version 1/);
    fireEvent.click(screen.getByRole('button', { name: 'Retire' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).queryByTestId('refusal')).toBeNull();
    expect(screen.queryAllByTestId('refusal')).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    reply = () => json(200, { id: 'r2', state: 'approved' });
    fireEvent.click(screen.getByTestId('approve-version'));
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'Rate version approved' }));
  });

  it('a retire refusal shows inside the confirmation only, which stays open', async () => {
    reply = () => json(403, refusal('FORBIDDEN_ROLE'));
    wrap(<VersionActions resource="unit-impact-rules" id="ir1" state="approved" timezone="Asia/Tehran" />);
    fireEvent.click(screen.getByRole('button', { name: 'Retire' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Retire unit impact rule' }));
    await waitFor(() => expect(within(dialog).getByTestId('refusal').getAttribute('data-kind')).toBe('role'));
    expect(screen.getAllByTestId('refusal')).toHaveLength(1);
    expect(toast).not.toHaveBeenCalled();
  });

  it('a new profile ends in the result dialog; the form is clean, so its links leave without asking', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    reply = (call) => (call.method === 'POST' ? json(201, PROFILE) : json(200, EMPTY));
    wrap(<ProfileEditor profile={null} refs={REFS} cancelTo="/setup/profiles" onSaved={() => undefined} />);
    fireEvent.change(screen.getByLabelText(/^Unit/), { target: { value: 'u1' } });
    fireEvent.change(screen.getByLabelText(/^Product/), { target: { value: 'p1' } });
    fireEvent.change(screen.getByLabelText(/Quantity unit/), { target: { value: 't' } });
    fireEvent.change(screen.getByLabelText(/^Rate timebase/), { target: { value: 'h' } });
    fireEvent.change(screen.getByLabelText('Effective from date'), { target: { value: '2026-10-10' } });
    fireEvent.change(screen.getByLabelText('Effective from time'), { target: { value: '06:00' } });
    fireEvent.click(screen.getByTestId('profile-save'));
    const dialog = await screen.findByRole('dialog', { name: 'Draft profile version created' });
    expect(within(dialog).getByText('Unit 1 · HDPE — version 1')).toBeTruthy();
    expect(within(dialog).getByRole('link', { name: 'View profile' }).getAttribute('href')).toBe('/planning/profiles/pr9');
    expect(within(dialog).getByRole('link', { name: 'Back to Profiles & rates' }).getAttribute('href')).toBe('/setup/profiles');
    expect(within(dialog).getByRole('link', { name: /^Next: / })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Add another' })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('link', { name: 'View profile' }));
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByTestId('where').textContent).toBe('/planning/profiles/pr9');
    expect(toast).not.toHaveBeenCalled();
  });

  it('a draft profile edit ends in a toast and opens the profile', async () => {
    const onSaved = vi.fn();
    reply = () => json(200, { ...PROFILE, rowVersion: 2 });
    wrap(<ProfileEditor profile={PROFILE} refs={REFS} cancelTo="/planning/profiles/pr9" onSaved={onSaved} />);
    fireEvent.change(screen.getByLabelText(/Quantity unit/), { target: { value: 'kg' } });
    fireEvent.click(screen.getByTestId('profile-save'));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(toast).toHaveBeenCalledWith({ title: 'Draft profile version updated' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('rate import: an accepted file disables Import (no double submit); the stored job shows its counts and clears the form', async () => {
    let finished = false;
    reply = (call) => {
      if (call.method === 'POST') return json(202, { jobId: 'job-1', statusUrl: '/api/v2/rate-imports/job-1' });
      if (call.path.endsWith('/rate-imports/job-1')) {
        const counts = finished ? { rows: 3, inserted: 3, retired: 1, errors: 0 } : null;
        return json(200, { id: 'job-1', kind: 'forecast', externalId: 'FC-1', revision: 2, fileRef: null, state: finished ? 'completed' : 'queued', counts, report: [], importedBy: null, createdAt: '', finishedAt: null });
      }
      return json(200, EMPTY);
    };
    wrap(<RateImportPage />);
    fireEvent.change(screen.getByLabelText(/^Document reference/), { target: { value: 'FC-1' } });
    fireEvent.change(screen.getByPlaceholderText(/^unitCode/), { target: { value: 'unitCode,productCode\nU1,P1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Import' }).hasAttribute('disabled')).toBe(true));
    expect(screen.getByTestId('disabled-reason').textContent).toMatch(/This file was sent/);
    expect(posted()).toHaveLength(1);

    finished = true;
    await client.invalidateQueries();
    const dialog = await screen.findByRole('dialog', { name: '3 rate versions imported' }, { timeout: 5000 });
    expect(within(dialog).getByText('Forecast FC-1, revision 2')).toBeTruthy();
    expect(within(dialog).getByText('3 lines read · 3 imported · 1 earlier version retired.')).toBeTruthy();
    expect(within(dialog).getByRole('link', { name: 'Back to Profiles & rates' }).getAttribute('href')).toBe('/setup/profiles');
    expect((screen.getByLabelText(/^Document reference/) as HTMLInputElement).value).toBe('');
    expect(screen.getByTestId('rate-import-submit').hasAttribute('disabled')).toBe(true);
  });

  it('crews: "Add crew" and "Add rotation" in the section header open dialogs; each ends in a toast and closes', async () => {
    reply = (call) => {
      if (call.method === 'POST' && call.path.endsWith('/crews')) return json(201, { id: 'crew-1', siteId: 's1', name: 'Crew A', rowVersion: 1, createdAt: '' });
      if (call.method === 'POST') return json(201, { rotation: { id: 'rot-1' }, materialization: [] });
      if (call.path.endsWith('/crews')) return json(200, { items: [{ id: 'crew-1', siteId: 's1', name: 'Crew A', rowVersion: 1, createdAt: '' }], nextCursor: null });
      return json(200, EMPTY);
    };
    wrap(<CrewRotationEditor siteId="s1" timezone="Asia/Tehran" />);
    expect(screen.queryByLabelText('Crew name')).toBeNull();
    fireEvent.click(screen.getByTestId('crew-add'));
    const crewDialog = await screen.findByRole('dialog', { name: 'Add crew' });
    fireEvent.change(within(crewDialog).getByLabelText('Crew name'), { target: { value: 'Crew A' } });
    fireEvent.click(within(crewDialog).getByRole('button', { name: 'Add crew' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'Crew added' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add crew' })).toBeNull());
    // the new crew is chosen and its rotations listed
    await waitFor(() => expect((screen.getByLabelText('Crew') as HTMLSelectElement).value).toBe('crew-1'));
    expect(screen.getByTestId('rotation-list')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('rotation-add').hasAttribute('disabled')).toBe(false));
    fireEvent.click(screen.getByTestId('rotation-add'));
    const rotationDialog = await screen.findByRole('dialog', { name: 'Add rotation' });
    expect((within(rotationDialog).getByLabelText('Crew') as HTMLSelectElement).value).toBe('crew-1');
    const submit = within(rotationDialog).getByRole('button', { name: 'Add rotation' });
    expect(submit.hasAttribute('disabled')).toBe(true);
    fireEvent.change(within(rotationDialog).getByLabelText(/^Cycle \(shift names/), { target: { value: 'A,A,B,B' } });
    fireEvent.change(within(rotationDialog).getByLabelText('Cycle day 1'), { target: { value: '2026-10-01' } });
    fireEvent.change(within(rotationDialog).getByLabelText('Effective from'), { target: { value: '2026-10-01' } });
    fireEvent.click(submit);
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'Rotation added' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add rotation' })).toBeNull());
  });

  it('crews: a refused rotation is the red alert inside the dialog, the input kept, no toast', async () => {
    reply = (call) => {
      if (call.method === 'POST') return json(409, refusal('VERSION_OVERLAP'));
      if (call.path.endsWith('/crews')) return json(200, { items: [{ id: 'crew-1', siteId: 's1', name: 'Crew A', rowVersion: 1, createdAt: '' }], nextCursor: null });
      return json(200, EMPTY);
    };
    wrap(<CrewRotationEditor siteId="s1" timezone="Asia/Tehran" />);
    await waitFor(() => expect(screen.getByTestId('rotation-add').hasAttribute('disabled')).toBe(false));
    fireEvent.click(screen.getByTestId('rotation-add'));
    const dialog = await screen.findByRole('dialog', { name: 'Add rotation' });
    fireEvent.change(within(dialog).getByLabelText('Crew'), { target: { value: 'crew-1' } });
    fireEvent.change(within(dialog).getByLabelText(/^Cycle \(shift names/), { target: { value: 'A,B' } });
    fireEvent.change(within(dialog).getByLabelText('Cycle day 1'), { target: { value: '2026-10-01' } });
    fireEvent.change(within(dialog).getByLabelText('Effective from'), { target: { value: '2026-10-01' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add rotation' }));
    const alert = await within(dialog).findByTestId('save-failure-alert');
    expect(within(dialog).getByTestId('rotation-form').firstElementChild).toBe(alert);
    expect((within(dialog).getByLabelText(/^Cycle \(shift names/) as HTMLInputElement).value).toBe('A,B');
    expect(toast).not.toHaveBeenCalled();
  });

  it('ending a stream run is a toast', async () => {
    reply = () => json(200, { id: 'run-1' });
    wrap(<EndRunAction runId="run-1" timezone="Asia/Tehran" />);
    fireEvent.click(screen.getByRole('button', { name: 'End run' }));
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-10-10' } });
    fireEvent.change(screen.getByLabelText('End time'), { target: { value: '06:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save end' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'Run ended' }));
    expect(screen.getByRole('button', { name: 'End run' })).toBeTruthy();
  });

  it('calendar: save is a toast and a clean editor; publish shows "Published: N shifts generated" across the redirect', async () => {
    let state = 'draft';
    reply = (call) => {
      if (call.path.endsWith('/calendar-versions/cal-1/publish')) {
        state = 'published';
        return json(200, { version: { ...DRAFT_CALENDAR, state, rowVersion: 3 }, materialization: [{ unitId: 'u1', from: '', to: '', insertedInstances: 12, deletedInstances: 0, unchangedDates: 0, hash: 'h' }] });
      }
      if (call.method === 'PATCH') return json(200, { ...DRAFT_CALENDAR, operationalDayStart: '07:00', rowVersion: 2 });
      if (call.path.endsWith('/calendar-versions/cal-1')) return json(200, { ...DRAFT_CALENDAR, state, rowVersion: state === 'draft' ? 1 : 3 });
      return json(200, EMPTY);
    };
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/planning/calendars/cal-1/edit']}>
          <Where />
          <Routes>
            <Route path="/planning/calendars/:versionId" element={<CalendarVersionPage />} />
            <Route path="/planning/calendars/:versionId/edit" element={<CalendarVersionPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const dayStart = await screen.findByLabelText(/^Operational day starts at/, {}, { timeout: 5000 });
    fireEvent.change(dayStart, { target: { value: '07:00' } });
    fireEvent.click(screen.getByTestId('calendar-save'));
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'Calendar draft saved' }));
    expect(screen.getByTestId('calendar-save').hasAttribute('disabled')).toBe(true);

    fireEvent.click(await screen.findByTestId('calendar-publish'));
    const dialog = await screen.findByRole('dialog', { name: 'Calendar published' }, { timeout: 5000 });
    expect(within(dialog).getByText('Published: 12 shifts generated.')).toBeTruthy();
    expect(within(dialog).getByRole('link', { name: 'Back to calendars' }).getAttribute('href')).toBe('/setup/calendars');
    expect(within(dialog).getByRole('link', { name: /^Next: / })).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/planning/calendars/cal-1'), { timeout: 5000 });
    expect(screen.getByRole('dialog', { name: 'Calendar published' })).toBeTruthy();
  });
});
