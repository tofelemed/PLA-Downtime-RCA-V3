import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { UnitStateCoverageView, UnitStateMappingView } from '@/api/v2/types/reliability';
import { actAs } from '@/test/acting-user';
import { errorBody, jsonResponse, listPage, stubV2Fetch, type V2Call } from '@/test/v2-fetch';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { UnitStatePage } = await import('./unit-state-page');

const MAPPING: UnitStateMappingView = {
  id: 'm1', unitId: 'u1', signalId: 's1', version: 1, rules: [{ match: 'RUN', state: 'running' }],
  expectedIntervalSeconds: 10, jitterSeconds: 2, staleAfterIntervals: 3, isHeartbeat: true, staleAfterSeconds: 32,
  notes: null, effectiveFrom: '2026-10-01T00:00:00.000Z', effectiveTo: null,
};
const COVERAGE: UnitStateCoverageView = {
  unitId: 'u1', from: '2026-10-01T00:00:00.000Z', to: '2026-10-01T08:00:00.000Z', truncated: false,
  coverage: {
    scheduledSeconds: 28800, runningSeconds: 21600, knownStoppedSeconds: 3600, unknownSeconds: 3600, coverage: 0.875,
    availabilityLower: 0.75, availabilityUpper: 0.875, knownTimeAvailability: 0.857, secondsByState: {},
  },
  segments: [
    { start: '2026-10-01T00:00:00.000Z', end: '2026-10-01T06:00:00.000Z', state: 'running', unknownReason: null },
    { start: '2026-10-01T06:00:00.000Z', end: '2026-10-01T07:00:00.000Z', state: 'unknown', unknownReason: 'stale' },
    { start: '2026-10-01T07:00:00.000Z', end: '2026-10-01T08:00:00.000Z', state: 'internal_stop', unknownReason: null },
  ],
};

function reply(call: V2Call) {
  const path = call.url.pathname;
  if (path.endsWith('/unit-state-mappings/coverage')) return jsonResponse(200, COVERAGE);
  if (path.endsWith('/unit-state-mappings') && call.method === 'POST') return jsonResponse(422, errorBody('VALIDATION_FAILED', 'signalId must be a state signal'));
  if (path.endsWith('/unit-state-mappings')) return jsonResponse(200, listPage([MAPPING]));
  if (path.endsWith('/signals')) return jsonResponse(200, listPage([{ id: 's1', name: 'Line state', sourceKey: 'L1.STATE', version: 1 }]));
  return undefined;
}

/** "New mapping version" in the versions section header opens the editor in the side panel. */
const openEditor = async () => {
  await screen.findByRole('table', { name: 'State mapping versions' });
  fireEvent.click(screen.getByRole('button', { name: 'New mapping version' }));
  await waitFor(() => expect((screen.getByLabelText('State signal') as HTMLSelectElement).value).toBe('s1'));
};

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={['/master-data/unit-state?unitId=u1']}><UnitStatePage /></MemoryRouter>
    </QueryClientProvider>,
  );

describe('Unit state page (SME D1 / D2)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin');
  });

  it('shows the versions and the coverage with provisional availability bounds; gaps stay unknown', async () => {
    stubV2Fetch(reply);
    actAs('integration_admin');
    renderPage();
    const versions = await screen.findByRole('table', { name: 'State mapping versions' });
    await waitFor(() => expect(within(versions).getByText('RUN → Running')).toBeInTheDocument());
    const facts = await screen.findByTestId('coverage-facts');
    expect(facts).toHaveTextContent('between 75.0 % and 87.5 %');
    expect(within(facts).getByText('Provisional')).toBeInTheDocument();
    expect(facts).toHaveTextContent('87.5 %');
    expect(screen.getByRole('img', { name: 'State timeline of the window' }).children).toHaveLength(3);
    expect(screen.getByText(/Unknown \(no data, stale, bad quality, unmapped\)/)).toBeInTheDocument();
  });

  it('QA M3: a window opening before the first mapping shows coverage from that mapping, and says so', async () => {
    const clipped = { ...COVERAGE, coverageStartsAt: '2026-10-01T02:00:00.000Z' };
    stubV2Fetch((call) => (call.url.pathname.endsWith('/unit-state-mappings/coverage') ? jsonResponse(200, clipped) : reply(call)));
    actAs('integration_admin');
    renderPage();
    const note = await screen.findByTestId('coverage-starts-at');
    expect(note).toHaveTextContent(/Coverage starts at .*, when the first state mapping came into force\./);
    expect(screen.getByTestId('coverage-facts')).toBeInTheDocument();
    expect(screen.queryByText(/no state mapping/i)).toBeNull();
  });

  it('records a new version from the one in force and shows the server refusal', async () => {
    const calls = stubV2Fetch(reply);
    actAs('integration_admin');
    renderPage();
    // the page reads versions, then coverage; the editor is closed until asked for
    await screen.findByRole('table', { name: 'State mapping versions' });
    expect(screen.queryByLabelText('State signal')).toBeNull();
    await openEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Add a value' }));
    fireEvent.change(screen.getByLabelText('Signal value 2'), { target: { value: 'STOP' } });
    fireEvent.change(screen.getByLabelText('State 2'), { target: { value: 'internal_stop' } });
    fireEvent.change(screen.getByLabelText(/Expected interval/), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record new version' }));
    expect(await screen.findByText('The server refused the mapping')).toBeInTheDocument();
    expect(screen.getByTestId('save-failure-alert')).toHaveFocus();
    expect(screen.getByLabelText(/Expected interval/)).toHaveValue('5');
    expect(screen.getByRole('dialog', { name: 'New mapping version' })).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
      unitId: 'u1', signalId: 's1', rules: [{ match: 'RUN', state: 'running' }, { match: 'STOP', state: 'internal_stop' }],
      expectedIntervalSeconds: 5, jitterSeconds: 2, staleAfterIntervals: 3, isHeartbeat: true,
    });
  });

  it('a new version that takes effect later ends in the result dialog and the editor starts again from it', async () => {
    const LATER: UnitStateMappingView = { ...MAPPING, id: 'm2', version: 2, expectedIntervalSeconds: 5, notes: 'faster feed', effectiveFrom: '2099-01-01T00:00:00.000Z' };
    let rows = [MAPPING];
    stubV2Fetch((call) => {
      const path = call.url.pathname;
      if (path.endsWith('/unit-state-mappings') && call.method === 'POST') {
        rows = [LATER, { ...MAPPING, effectiveTo: LATER.effectiveFrom }];
        return jsonResponse(201, LATER);
      }
      if (path.endsWith('/unit-state-mappings') && call.method === 'GET') return jsonResponse(200, listPage(rows));
      return reply(call);
    });
    actAs('integration_admin');
    renderPage();
    await openEditor();
    fireEvent.change(screen.getByLabelText(/Expected interval/), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'faster feed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record new version' }));
    const dialog = await screen.findByTestId('save-result-dialog');
    expect(within(dialog).getByText('Mapping version 2 recorded')).toBeInTheDocument();
    expect(within(dialog).getByText(/^It takes effect at .*; the version in force stays until then\.$/)).toBeInTheDocument();
    // the list is the page already shown: no redundant "Back to Unit state"
    expect(within(dialog).queryByRole('link', { name: 'Back to Unit state' })).toBeNull();
    // success closes the panel; the next one starts from the saved version
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New mapping version' })).toBeNull());
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('save-result-dialog')).toBeNull());
    await openEditor();
    await waitFor(() => expect(screen.getByLabelText('Notes')).toHaveValue(''));
    expect(screen.getByLabelText(/Expected interval/)).toHaveValue('5');
    expect(screen.queryByTestId('save-failure-alert')).toBeNull();
  });

  it('a role that may not write mappings only reads them', async () => {
    stubV2Fetch(reply);
    actAs('master_data_admin');
    renderPage();
    expect(await screen.findByRole('table', { name: 'State mapping versions' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New mapping version' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Record new version' })).toBeNull();
  });
});
