import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { configureV2Session } from '@/api/v2/config';
import type { PlanVersionView, PlanView } from '@/api/v2/types/plans';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { PlanForm } = await import('./plans/plan-form');
const { ProfileEditor } = await import('./profiles/profile-editor');
const { CalendarEditor } = await import('./calendars/calendar-editor');
const { StreamRunsPanel } = await import('./streams/stream-runs-panel');
const { RateImportPage } = await import('./profiles/rate-import-page');
const { useUnitParam } = await import('./hooks/use-unit-param');
const { newCalendarDraft } = await import('./model/calendar-draft');
const { previewBlockedReason } = await import('./model/calendar-preview');
const { importBlockedReason } = await import('./model/rate-import');
const { emptyPlanForm, validatePlanForm } = await import('./model/plan-form');
const { PLANNING_ROUTES } = await import('@/app/routes/production-planning');

const REFS = {
  timezone: 'Asia/Tehran',
  timezoneIsFallback: false,
  unitOptions: [{ value: 'u1', label: 'Unit 1' }],
  productOptions: [{ value: 'p1', label: 'HDPE (P1)' }],
  siteOptions: [],
  defaultSiteId: null,
  unitName: () => 'Unit 1',
  productName: () => 'HDPE',
  loading: false,
};

const PLAN = { id: 'plan-1', name: 'Extruder plan', scenarioId: null } as unknown as PlanView;
const APPROVED = {
  id: 'v1', planId: 'plan-1', version: 1, unitId: 'u1', validFrom: '2026-11-01T02:30:00.000Z', validTo: '2026-11-02T02:30:00.000Z', basis: 'quantity',
  headerTarget: '672', distribution: 'scheduled_capacity', approvalState: 'approved', manualTargets: null, rowVersion: 2,
  slices: [{ productId: 'p1', campaignFrom: '2026-11-01T02:30:00.000Z', campaignTo: '2026-11-02T02:30:00.000Z', weight: null, target: null }],
} as unknown as PlanVersionView;

interface Call {
  method: string;
  url: URL;
  body: Record<string, unknown> | null;
}

function Where() {
  return <p data-testid="where">{useLocation().pathname + useLocation().search}</p>;
}

function UnitPicker() {
  const [unitId, setUnitId] = useUnitParam();
  return (
    <button type="button" onClick={() => setUnitId(unitId ? '' : 'u1')}>
      unit:{unitId}
    </button>
  );
}

describe('QA planning: forms, reasons and URL state', () => {
  let calls: Call[];
  let client: QueryClient;
  const wrap = (node: ReactNode, at = '/form') =>
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[at]}>
          <Where />
          <Routes>
            <Route path="/form" element={node} />
            <Route path="/planning" element={<p>Planning list</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    calls = [];
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url: new URL(url), body: init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null };
      calls.push(call);
      if (call.method === 'POST') return new Response(JSON.stringify({ ...APPROVED, id: 'v2', version: 2, approvalState: 'draft' }), { status: 201, headers: { 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ items: [], nextCursor: null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    actAs('SuperAdmin');
  });

  it('a new plan version needs a change reason (model)', () => {
    const values = { ...emptyPlanForm(), unitId: 'u1', validFrom: '2026-11-01T06:00', validTo: '2026-11-02T06:00', headerTarget: '672', slices: [{ productId: 'p1', campaignFrom: '', campaignTo: '', weight: null, target: null }] };
    expect(validatePlanForm(values, 'Asia/Tehran', false, true).changeReason).toBe('Say why this version changes the approved plan');
    expect(validatePlanForm({ ...values, changeReason: 'New rate' }, 'Asia/Tehran', false, true)).toEqual({});
    expect(validatePlanForm(values, 'Asia/Tehran', false)).toEqual({});
  });

  it('Create new version: reason required, unit locked, then a confirmation before the POST (P-3)', async () => {
    wrap(<PlanForm mode={{ kind: 'new-version', plan: PLAN, version: APPROVED }} refs={REFS} cancelTo="/planning" onSaved={() => undefined} />);
    expect((screen.getByLabelText(/^Unit/) as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByLabelText(/^Change reason/).getAttribute('aria-required')).toBe('true');
    fireEvent.click(screen.getByTestId('plan-save'));
    expect(await screen.findByTestId('field-error-changeReason')).toBeTruthy();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    fireEvent.change(screen.getByLabelText(/^Change reason/), { target: { value: 'Planning rate revised' } });
    fireEvent.click(screen.getByTestId('plan-save'));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Create version 2 of Extruder plan?')).toBeTruthy();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create version' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST');
    expect(post?.url.pathname).toMatch(/\/v2\/production-plans\/plan-1\/versions$/);
    expect(post?.body).toMatchObject({ unitId: 'u1', changeReason: 'Planning rate revised' });
  });

  it('New plan marks its required fields and asks before Cancel leaves typed text (P-5)', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    wrap(<PlanForm mode={{ kind: 'create' }} refs={REFS} cancelTo="/planning" onSaved={() => undefined} />);
    expect(screen.getByLabelText(/^Name/).getAttribute('aria-required')).toBe('true');
    expect(screen.getByRole('group', { name: /Window start/ }).textContent).toContain('*');
    fireEvent.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByTestId('where').textContent).toBe('/planning');
  });

  it('a dirty New plan form stays when the user declines to leave', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    wrap(<PlanForm mode={{ kind: 'create' }} refs={REFS} cancelTo="/planning" onSaved={() => undefined} />);
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Extruder plan' } });
    fireEvent.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByTestId('where').textContent).toBe('/form');
  });

  it('the profile editor marks required fields and guards unsaved edits', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    wrap(<ProfileEditor profile={null} refs={REFS} cancelTo="/planning" onSaved={() => undefined} />);
    for (const label of [/^Unit/, /^Product/, /^Quantity unit/, /^Rate timebase/]) expect(screen.getByLabelText(label).getAttribute('aria-required')).toBe('true');
    fireEvent.change(screen.getByLabelText(/^Quantity unit/), { target: { value: 't' } });
    fireEvent.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByTestId('where').textContent).toBe('/form');
  });

  it('the calendar editor has a Cancel, required markers and a guard; a non-writer gets a view-only notice', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const props = { version: null, seed: newCalendarDraft('Asia/Tehran'), scope: { siteId: 's1' }, displayTimezone: 'Asia/Tehran', onSaved: vi.fn(), onNewFrom: vi.fn(), onPreview: vi.fn() };
    const first = wrap(<CalendarEditor {...props} />);
    expect(screen.getByLabelText(/^Operational day starts at/).getAttribute('aria-required')).toBe('true');
    fireEvent.click(screen.getByTestId('calendar-cancel'));
    expect(confirm).not.toHaveBeenCalled();
    first.unmount();
    wrap(<CalendarEditor {...props} />);
    fireEvent.change(screen.getByLabelText(/^Operational day starts at/), { target: { value: '07:00' } });
    fireEvent.click(screen.getByTestId('calendar-cancel'));
    expect(confirm).toHaveBeenCalled();
    actAs('Operator');
    wrap(<CalendarEditor {...props} />);
    expect(screen.getByTestId('calendar-view-only')).toBeTruthy();
  });

  it('disabled buttons say why: Record run, Run preview, Import (QA planning)', () => {
    wrap(<StreamRunsPanel unitId="u1" refs={REFS} streamOptions={[]} canWrite />);
    const record = screen.getByRole('button', { name: /Record run/ });
    expect(record.hasAttribute('disabled')).toBe(true);
    expect(document.getElementById(record.getAttribute('aria-describedby') ?? '')?.textContent).toMatch(/Add a stream first/);
    expect(previewBlockedReason({ candidate: true, unitId: '', localFrom: '', localTo: '' })).toBe('Choose a unit first.');
    expect(previewBlockedReason({ candidate: false, unitId: 'u1', localFrom: 'a', localTo: 'b' })).toMatch(/Preview/);
    expect(previewBlockedReason({ candidate: true, unitId: 'u1', localFrom: '2026-11-01', localTo: '' })).toMatch(/operational dates/);
    expect(previewBlockedReason({ candidate: true, unitId: 'u1', localFrom: '2026-11-01', localTo: '2026-11-02' })).toBeNull();
    expect(importBlockedReason({ externalId: 'BUD-1', csv: '' })).toBe('Choose a file first (or paste its lines).');
    expect(importBlockedReason({ externalId: '', csv: 'x' })).toBe('Enter the document reference first.');
    expect(importBlockedReason({ externalId: 'BUD-1', csv: 'x' })).toBeNull();
  });

  it('the rate import page explains its disabled Import and has a Cancel', () => {
    wrap(<RateImportPage />);
    const button = screen.getByRole('button', { name: 'Import' });
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(screen.getByTestId('disabled-reason').textContent).toMatch(/Choose a file/);
    expect(screen.getByRole('link', { name: 'Cancel' }).getAttribute('href')).toBe('/planning?tab=profiles');
  });

  it('Import rates asks before Cancel leaves a typed document reference (P-5 re-test)', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    wrap(<RateImportPage />);
    fireEvent.change(screen.getByLabelText(/^Document reference/), { target: { value: 'qa test text' } });
    fireEvent.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByTestId('where').textContent).toBe('/form');
  });

  it('the planning unit picker lives in the URL next to the tab', () => {
    wrap(<UnitPicker />, '/form?tab=streams');
    fireEvent.click(screen.getByRole('button', { name: 'unit:' }));
    expect(screen.getByTestId('where').textContent).toBe('/form?tab=streams&unitId=u1');
    fireEvent.click(screen.getByRole('button', { name: 'unit:u1' }));
    expect(screen.getByTestId('where').textContent).toBe('/form?tab=streams');
  });

  it('New profile and New calendar direct URLs are gated for non-writers', () => {
    const route = (path: string) => PLANNING_ROUTES.find((r) => r.path === path);
    expect(route('/planning/profiles/new')?.requires).toBe('canWriteProfiles');
    expect(route('/planning/calendars/new')?.requires).toBe('canWriteCalendars');
  });
});
