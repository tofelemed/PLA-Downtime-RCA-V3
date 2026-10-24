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

  it('Register standby opens a dialog; registering ends in the result dialog and Add another opens an empty form', async () => {
    const calls = stubV2Fetch((call) => (call.method === 'POST' && call.url.pathname.endsWith('/standby-equipment') ? jsonResponse(201, { ...REGISTRATION, id: 's2', evaluation: 'running' }) : reply(call)));
    actAs('SuperAdmin');
    renderPage();
    fireEvent.click(await within(screen.getByRole('banner')).findByRole('button', { name: 'Register standby' }));
    const form = await screen.findByTestId('standby-register-dialog');
    await waitFor(() => expect(within(form).getAllByRole('option', { name: 'P-101B — Spare feed pump' }).length).toBeGreaterThan(0));
    fireEvent.change(within(form).getByLabelText('Asset'), { target: { value: 'a1' } });
    fireEvent.change(within(form).getByLabelText('Evaluated'), { target: { value: 'running' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Register' }));
    const dialog = await screen.findByTestId('save-result-dialog');
    expect(within(dialog).getByText('Standby equipment registered')).toBeInTheDocument();
    expect(within(dialog).getByText('P-101B — Spare feed pump')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Back to Standby equipment' })).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST' && c.url.pathname.endsWith('/standby-equipment'))?.body).toEqual({ assetId: 'a1', evaluation: 'running' });
    expect(screen.queryByTestId('standby-register-dialog')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add another' }));
    const again = await screen.findByTestId('standby-register-dialog');
    expect((within(again).getByLabelText('Asset') as HTMLSelectElement).value).toBe('');
    expect((within(again).getByLabelText('Evaluated') as HTMLSelectElement).value).toBe('demand');
  });

  it('a refused retire is a red alert inside the confirmation, which stays open', async () => {
    stubV2Fetch((call) => (call.url.pathname.endsWith('/retire') ? jsonResponse(409, errorBody('STALE_ROW_VERSION', 'The registration changed')) : reply(call)));
    actAs('SuperAdmin');
    renderPage();
    const table = await screen.findByRole('table', { name: 'Standby registrations' });
    fireEvent.click(await within(table).findByRole('button', { name: 'Retire' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Retire standby' }));
    expect(await within(dialog).findByTestId('save-failure-alert')).toBeInTheDocument();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('shows the table first and Import log CSV / Register standby in the header, without bottom forms', async () => {
    stubV2Fetch(reply);
    actAs('SuperAdmin');
    renderPage();
    await screen.findByRole('table', { name: 'Standby registrations' });
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('link', { name: 'Import log CSV' }).getAttribute('href')).toBe('/master-data/standby-equipment/import');
    expect(within(header).getByRole('button', { name: 'Register standby' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Register standby equipment' })).toBeNull();
    expect(screen.queryByTestId('standby-log-import')).toBeNull();
    expect(screen.queryByLabelText('Asset')).toBeNull();
  });

  it('a role that may not write sees no register, retire or import', async () => {
    stubV2Fetch(reply);
    actAs('master_data_admin');
    renderPage();
    expect(await screen.findByRole('table', { name: 'Standby registrations' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retire' })).toBeNull();
    expect(screen.queryByTestId('standby-import-open')).toBeNull();
    expect(screen.queryByTestId('standby-register-new')).toBeNull();
  });
});

// Configuration cleanup (24 Oct 2026): no header description; Registrations, Measures and Log entries cards; a compact window row
describe('Standby equipment cleanup', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin');
  });

  it('has no description; three report cards with own empty messages; the window is typed dates, not browser date inputs', async () => {
    stubV2Fetch((call) => (call.url.pathname.endsWith('/standby-equipment/metrics') ? jsonResponse(200, []) : call.url.pathname.endsWith('/assets') ? reply(call) : undefined));
    renderPage();
    expect(screen.queryByText(/judged on failed starts per demand, not on calendar time\.$/)).toBeNull();
    for (const title of ['Registrations', 'Measures', 'Log entries']) expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About Registrations' })).toBeInTheDocument();
    expect(await screen.findByText('No standby equipment in this window.')).toBeInTheDocument();
    expect(await screen.findByText('No log entries in this window.')).toBeInTheDocument();
    expect(screen.queryByText('No data for these dates')).toBeNull();
    const window = screen.getByTestId('standby-window');
    expect(window.querySelector('input[type=date]')).toBeNull();
    expect(within(window).getAllByRole('textbox').every((input) => input.className.includes('h-9'))).toBe(true);
  });

  it('Register standby: Asset focused, Cancel before Register, Cancel closes and Esc closes', async () => {
    stubV2Fetch(reply);
    renderPage();
    fireEvent.click(await screen.findByTestId('standby-register-new'));
    const dialog = await screen.findByTestId('standby-register-dialog');
    await waitFor(() => expect(within(dialog).getByLabelText('Asset')).toHaveFocus());
    const names = within(dialog).getAllByRole('button').map((button) => button.textContent?.trim());
    expect(names.indexOf('Cancel')).toBeLessThan(names.indexOf('Register'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByTestId('standby-register-dialog')).toBeNull());
    fireEvent.click(screen.getByTestId('standby-register-new'));
    fireEvent.keyDown(await screen.findByTestId('standby-register-dialog'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('standby-register-dialog')).toBeNull());
  });
});
