import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { StandbyEquipmentView, StandbyMetricsView } from '@/api/v2/types/reliability';
import { actAs } from '@/test/acting-user';
import { errorBody, jsonResponse, listPage, stubV2Fetch, type V2Call } from '@/test/v2-fetch';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { StandbyEquipmentPage } = await import('./standby-page');

const ASSET = { id: 'a1', code: 'P-101B', name: 'Spare feed pump', unitId: 'u1', assetType: 'Pump', retiredAt: null, rowVersion: 1 };
const REGISTRATION: StandbyEquipmentView = {
  id: 's1', assetId: 'a1', unitId: 'u1', evaluation: 'demand_and_running', notes: null, effectiveFrom: '2026-01-01T00:00:00.000Z', effectiveTo: null, rowVersion: 1,
};
const METRICS: StandbyMetricsView = {
  assetId: 'a1', unitId: 'u1', evaluation: 'demand_and_running', demands: 20, failedStarts: 1,
  failureOnDemand: { numerator: 1, denominator: 20, value: 0.05, reason: null }, tests: 0, failedTests: 0,
  testFailureFraction: { numerator: 0, denominator: 0, value: null, reason: 'no_tests' }, runningSeconds: 180000, failuresWhileRunning: 0,
  operatingMtbf: { numerator: 180000, denominator: 0, value: null, reason: 'no_failures' }, standbySeconds: 3600,
};

function reply(call: V2Call) {
  const path = call.url.pathname;
  if (path.endsWith('/assets')) return jsonResponse(200, listPage([ASSET]));
  if (path.endsWith('/standby-equipment/metrics')) return jsonResponse(200, [METRICS]);
  if (path.endsWith('/standby-equipment') && call.method === 'GET') return jsonResponse(200, listPage([REGISTRATION]));
  if (path.endsWith('/standby-equipment/s1/retire')) return jsonResponse(200, { ...REGISTRATION, effectiveTo: '2026-10-18T00:00:00.000Z' });
  if (path.endsWith('/standby-records/import')) {
    return jsonResponse(422, errorBody('STANDBY_IMPORT_INVALID', 'The import has 1 invalid row(s)', { errors: [{ line: 1, message: 'assetId / assetCode must name an asset of this plant' }] }));
  }
  return undefined;
}

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter><StandbyEquipmentPage /></MemoryRouter>
    </QueryClientProvider>,
  );

describe('Standby equipment page (SME D9)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin');
  });

  it('shows the server measures: failure on demand with its counts, MTBF as exposure without failures', async () => {
    stubV2Fetch(reply);
    actAs('reliability_engineer');
    renderPage();
    const table = await screen.findByRole('table', { name: 'Standby measures per asset' });
    await waitFor(() => expect(within(table).getByText(/\(1 of 20\)/)).toBeInTheDocument());
    expect(within(table).getByText(/^No failures — exposure /)).toBeInTheDocument();
    expect(within(table).queryByText(/infinit|∞/i)).toBeNull();
    expect(within(table).getByText('P-101B — Spare feed pump')).toBeInTheDocument();
  });

  it('checks pasted rows here, then shows the row problems the server refused', async () => {
    const calls = stubV2Fetch(reply);
    actAs('operator');
    renderPage();
    const panel = await screen.findByTestId('standby-log-import');
    const box = within(panel).getByRole('textbox');
    fireEvent.change(box, { target: { value: 'assetCode,kind,startedAt,outcome\nP-9,demand,2026-10-01 08:00,success' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Check' }));
    expect(within(panel).getByText(/startedAt must be an ISO 8601 time/)).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
    fireEvent.change(box, { target: { value: 'assetCode,kind,startedAt,outcome\nP-9,demand,2026-10-01T08:00:00Z,success' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Import' }));
    expect(await within(panel).findByText(/assetId \/ assetCode must name an asset/)).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ records: [{ assetCode: 'P-9', kind: 'demand', startedAt: '2026-10-01T08:00:00Z', endedAt: null, outcome: 'success' }] });
  });

  it('Retire asks for confirmation before ending the duty', async () => {
    const calls = stubV2Fetch(reply);
    actAs('SuperAdmin');
    renderPage();
    const table = await screen.findByRole('table', { name: 'Standby registrations' });
    fireEvent.click(await within(table).findByRole('button', { name: 'Retire' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(calls.some((c) => c.url.pathname.endsWith('/retire'))).toBe(false);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(calls.some((c) => c.url.pathname.endsWith('/retire'))).toBe(false);
    fireEvent.click(within(table).getByRole('button', { name: 'Retire' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Retire standby' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.url.pathname.endsWith('/standby-equipment/s1/retire'))).toBe(true));
  });

  it('a role that may not write sees no register, retire or import', async () => {
    stubV2Fetch(reply);
    actAs('master_data_admin');
    renderPage();
    expect(await screen.findByRole('table', { name: 'Standby registrations' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retire' })).toBeNull();
    expect(screen.queryByTestId('standby-log-import')).toBeNull();
  });
});
