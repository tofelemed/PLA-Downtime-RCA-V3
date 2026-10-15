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

  it('records a new version from the one in force and shows the server refusal', async () => {
    const calls = stubV2Fetch(reply);
    actAs('integration_admin');
    renderPage();
    await waitFor(() => expect((screen.getByLabelText('State signal') as HTMLSelectElement).value).toBe('s1'));
    fireEvent.click(screen.getByRole('button', { name: 'Add a value' }));
    fireEvent.change(screen.getByLabelText('Signal value 2'), { target: { value: 'STOP' } });
    fireEvent.change(screen.getByLabelText('State 2'), { target: { value: 'internal_stop' } });
    fireEvent.change(screen.getByLabelText(/Expected interval/), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record new version' }));
    expect(await screen.findByText('The server refused the mapping')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
      unitId: 'u1', signalId: 's1', rules: [{ match: 'RUN', state: 'running' }, { match: 'STOP', state: 'internal_stop' }],
      expectedIntervalSeconds: 5, jitterSeconds: 2, staleAfterIntervals: 3, isHeartbeat: true,
    });
  });

  it('a role that may not write mappings only reads them', async () => {
    stubV2Fetch(reply);
    actAs('master_data_admin');
    renderPage();
    expect(await screen.findByRole('table', { name: 'State mapping versions' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Record new version' })).toBeNull();
  });
});
