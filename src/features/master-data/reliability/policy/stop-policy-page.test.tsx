import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { MicroStopPolicyView, TransitionAllowanceView } from '@/api/v2/types/reliability';
import { actAs } from '@/test/acting-user';
import { errorBody, jsonResponse, stubV2Fetch, type V2Call } from '@/test/v2-fetch';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { StopPolicyPage } = await import('./stop-policy-page');

const MICRO: MicroStopPolicyView = {
  id: 'p1', unitId: null, version: 4, microStopSeconds: 60, microStopSecondsByAssetClass: { Bagger: 120 },
  tripReasonCodes: ['ELEC-MTR'], effectiveFrom: '2026-10-14T00:00:00.000Z', notes: null,
  requestedEffectiveFrom: null, backdateReason: null,
};
const ALLOWANCE: TransitionAllowanceView = { id: 'p1', unitId: null, version: 4, transitionAllowanceInPlan: 'planned', effectiveFrom: MICRO.effectiveFrom, notes: null };

const STOP = { id: 'p1', unitId: null, version: 4, effectiveFrom: MICRO.effectiveFrom, notes: null, deriveFromState: true, debounceSeconds: 5, restartConfirmSeconds: 10, duplicateToleranceSeconds: 120, autoMergeDuplicates: true, incidentWindowSeconds: 120 };

function reply(call: V2Call) {
  if (call.url.pathname.endsWith('/stop-event-policies/current')) return jsonResponse(200, STOP);
  if (call.url.pathname.endsWith('/stop-event-policies')) return jsonResponse(201, { ...STOP, ...(call.body ?? {}), version: 5 });
  if (call.url.pathname.endsWith('/micro-stop-policies/current')) return jsonResponse(200, MICRO);
  if (call.url.pathname.endsWith('/transition-allowance-policies/current')) return jsonResponse(200, ALLOWANCE);
  if (call.method === 'POST' && call.url.pathname.endsWith('/transition-allowance-policies')) {
    return jsonResponse(403, errorBody('TENANT_SCOPE_REQUIRED', 'This change is not limited to your units; a tenant-wide grant is required'));
  }
  if (call.method === 'POST') return jsonResponse(201, { ...MICRO, version: 5 });
  return undefined;
}

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={['/master-data/stop-policy']}>
        <StopPolicyPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('Stop and plan policy page (SME D6, engine 2.5.6)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin');
  });

  it('QA M1 / M7: a seeded plant default reads "Built-in default (from the start)" with a plain note, never 1970 or D04', async () => {
    const EPOCH = '1970-01-01T00:00:00.000Z';
    const SEED = 'Seeded on first use from the D04 / D05 / D06 / D13 default (DECISIONS.md, 2026-10-07); change by a new version.';
    stubV2Fetch((call) => {
      if (call.url.pathname.endsWith('/stop-event-policies/current')) return jsonResponse(200, { ...STOP, version: 1, effectiveFrom: EPOCH, notes: SEED });
      if (call.url.pathname.endsWith('/micro-stop-policies/current')) return jsonResponse(200, { ...MICRO, version: 1, effectiveFrom: EPOCH, notes: SEED });
      if (call.url.pathname.endsWith('/transition-allowance-policies/current')) return jsonResponse(200, { ...ALLOWANCE, version: 1, effectiveFrom: EPOCH });
      return reply(call);
    });
    actAs('manager_approver');
    renderPage();
    const micro = await screen.findByTestId('micro-stop-current');
    expect(micro).toHaveTextContent('Version 1 · plant-wide · Built-in default (from the start)');
    expect(micro).toHaveTextContent('Built-in default; change it by recording a new version.');
    expect(await screen.findByTestId('transition-allowance')).toHaveTextContent('Built-in default (from the start)');
    await waitFor(() => expect(screen.getAllByTestId('built-in-default-start').length).toBeGreaterThan(0));
    expect(document.body).not.toHaveTextContent('1970');
    expect(document.body).not.toHaveTextContent('D04');
  });

  it('QA M4: a role without master-data access gets the standard "No access" page with the page title', () => {
    actAs('operator');
    renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByText('No access')).toBeInTheDocument();
    expect(screen.getByText(/Your roles in this plant do not include/)).toBeInTheDocument();
    expect(document.title).not.toBe('');
  });

  it('shows the plant settings in force and records a micro-stop version carrying the class thresholds', async () => {
    const calls = stubV2Fetch(reply);
    actAs('manager_approver');
    renderPage();
    expect(await screen.findByTestId('micro-stop-current')).toHaveTextContent('Version 4 · plant-wide · in force since');
    expect(screen.getByTestId('micro-stop-current')).toHaveTextContent('ELEC-MTR');
    fireEvent.change(screen.getByLabelText(/Micro-stop threshold/), { target: { value: '90' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record new version (effective now)' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST');
    expect(post?.url.pathname).toBe('/api/v2/micro-stop-policies');
    expect(post?.body).toEqual({ microStopSeconds: 90, microStopSecondsByAssetClass: { Bagger: 120 }, tripReasonCodes: ['ELEC-MTR'] });
    expect(post?.headers.get('Idempotency-Key')).toBeTruthy();
  });

  it('explains both grade-change choices and shows what the server refuses', async () => {
    stubV2Fetch(reply);
    actAs('manager_approver');
    renderPage();
    expect(await screen.findByText('Plans already allow for standard grade changes')).toBeInTheDocument();
    expect(screen.getByText('Count the allowance against the plan')).toBeInTheDocument();
    expect(screen.getByText(/Periods already calculated keep the version/)).toBeInTheDocument();
    const record = screen.getByRole('button', { name: 'Record (effective from now)' });
    expect(record).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Count the allowance against the plan/));
    fireEvent.click(record);
    expect(await screen.findByText('A plant-wide policy needs an approver for the whole plant')).toBeInTheDocument();
    expect(screen.getByText(/Choose one of your units, or ask a plant-level approver/)).toBeInTheDocument();
    expect(screen.queryByText('Choose a plant first')).toBeNull();
  });

  it('validates whole seconds and records only the declared stop-engine fields', async () => {
    const calls = stubV2Fetch(reply);
    actAs('SuperAdmin');
    renderPage();
    const debounce = await screen.findByLabelText('Stop debounce (seconds)');
    fireEvent.change(debounce, { target: { value: '-1' } });
    const save = screen.getByRole('button', { name: 'Record stop-engine settings (effective from now)' });
    expect(save).toBeDisabled();
    fireEvent.change(debounce, { target: { value: '8' } });
    fireEvent.click(save);
    await screen.findByRole('status');
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ deriveFromState: true, debounceSeconds: 8, restartConfirmSeconds: 10, duplicateToleranceSeconds: 120, autoMergeDuplicates: true, incidentWindowSeconds: 120, notes: '' });
  });

  it('sends a commissioning backdate with its reason and lists the calculated periods the server refuses it over', async () => {
    const overlap = {
      ...errorBody('BACKDATE_OVERLAPS_CALCULATION', 'effectiveFrom overlaps 1 calculated period(s)'),
      details: { total: 1, periods: [{ periodId: 'pp1', unitId: 'u1', unitName: 'Extruder 1', localDate: '2026-10-02', shiftName: 'Day', utcStart: '2026-10-02T02:30:00.000Z', utcEnd: '2026-10-02T10:30:00.000Z' }] },
    };
    const calls = stubV2Fetch((call) => (call.method === 'POST' && call.url.pathname.endsWith('/stop-event-policies') ? jsonResponse(409, overlap) : reply(call)));
    actAs('SuperAdmin');
    renderPage();
    await screen.findByLabelText('Stop debounce (seconds)');
    const commissioning = screen.getByTestId('stop-engine-commissioning');
    expect(commissioning).toHaveTextContent('Only while commissioning');
    fireEvent.change(within(commissioning).getByLabelText('Effective from (commissioning only) date'), { target: { value: '2026-10-01' } });
    const save = screen.getByRole('button', { name: 'Record stop-engine settings (backdated)' });
    fireEvent.click(save);
    expect(await within(commissioning).findByText('Give the reason for backdating')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
    fireEvent.change(within(commissioning).getByLabelText(/Reason for backdating/), { target: { value: ' meter commissioned 1 Oct ' } });
    fireEvent.click(save);
    expect(await screen.findByText('Figures were already calculated in this range')).toBeInTheDocument();
    expect(screen.getByTestId('backdate-overlap')).toHaveTextContent('Extruder 1 · 2026-10-02 · Day');
    const body = calls.find((c) => c.method === 'POST')?.body;
    expect(body).toMatchObject({ backdateReason: 'meter commissioned 1 Oct' });
    expect(typeof body?.effectiveFrom).toBe('string');
  });

  it('a reader sees the settings without any way to record a version', async () => {
    stubV2Fetch(reply);
    actAs('master_data_admin');
    renderPage();
    expect(await screen.findByTestId('transition-allowance')).toBeInTheDocument();
    expect(screen.getByText('Only manager approvers record new versions.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Record/ })).toBeNull();
  });
});
