import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { actAs } from '@/test/acting-user';
import { errorBody, jsonResponse, stubV2Fetch, type V2Call } from '@/test/v2-fetch';

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { FlowRouteDialog } = await import('./flow-route-dialog');
const { BufferLevelDialog } = await import('./buffer-level-dialog');
const { BufferLevelsSection } = await import('./buffer-levels-section');
const { PlantFlowPage } = await import('./plant-flow-page');

const TZ = 'Asia/Tehran';
const UNITS = [{ value: 'u1', label: 'Reactor' }, { value: 'u2', label: 'Extruder' }];

const ROUTE = { id: 'fr1', fromUnitId: 'u1', toUnitId: 'u2', routeRole: 'feed', state: 'draft', effectiveFrom: '2026-10-01T02:30:00.000Z', effectiveTo: null, rowVersion: 1 };
const LEVEL = { id: 'bl1', fromUnitId: 'u1', toUnitId: 'u2', observedAt: '2026-10-01T02:30:00.000Z', level: '60', uom: 't', source: 'manual' };

describe('plant flow save feedback (DECISIONS 2026-10-22)', () => {
  let reply: (call: V2Call) => Response | undefined;
  const wrap = (node: ReactNode) =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <MemoryRouter>{node}</MemoryRouter>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    actAs('SuperAdmin');
    toast.mockReset();
    reply = () => undefined;
    stubV2Fetch((call) => reply(call));
  });
  afterEach(() => vi.unstubAllGlobals());

  const fillRoute = () => {
    fireEvent.change(screen.getByLabelText('From unit (supplies)'), { target: { value: 'u1' } });
    fireEvent.change(screen.getByLabelText('To unit (is supplied)'), { target: { value: 'u2' } });
    fireEvent.change(screen.getByLabelText('Effective from date'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Effective from time'), { target: { value: '06:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add draft route' }));
  };

  it('an added route ends in a toast and the dialog closes', async () => {
    reply = (call) => (call.method === 'POST' ? jsonResponse(201, ROUTE) : undefined);
    const onDone = vi.fn();
    wrap(<FlowRouteDialog unitOptions={UNITS} timezone={TZ} onDone={onDone} />);
    fillRoute();
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'Draft route added' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('a refused route is the red alert at the top of the dialog form, the input kept, no toast', async () => {
    reply = (call) => (call.method === 'POST' ? jsonResponse(422, errorBody('FLOW_ROUTE_CYCLE', 'cycle')) : undefined);
    const onDone = vi.fn();
    wrap(<FlowRouteDialog unitOptions={UNITS} timezone={TZ} onDone={onDone} />);
    fillRoute();
    const alert = await screen.findByTestId('save-failure-alert');
    expect(screen.getByTestId('flow-route-form').firstElementChild).toBe(alert);
    expect(alert.querySelector('[data-testid="refusal"][data-code="FLOW_ROUTE_CYCLE"]')).toBeTruthy();
    expect((screen.getByLabelText('From unit (supplies)') as HTMLSelectElement).value).toBe('u1');
    expect(onDone).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  const fillLevel = () => {
    fireEvent.change(screen.getByLabelText('Buffer'), { target: { value: 'u1|u2' } });
    fireEvent.change(screen.getByLabelText('Read at date'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Read at time'), { target: { value: '06:00' } });
    fireEvent.change(screen.getByLabelText('Buffer level'), { target: { value: '60' } });
    fireEvent.blur(screen.getByLabelText('Buffer level'));
    fireEvent.click(screen.getByRole('button', { name: 'Record level' }));
  };
  const BUFFERS = [{ value: 'u1|u2', label: 'Reactor → Extruder' }];

  it('a recorded level ends in a toast and the dialog closes', async () => {
    reply = (call) => (call.method === 'POST' ? jsonResponse(201, LEVEL) : undefined);
    const onClose = vi.fn();
    wrap(<BufferLevelDialog bufferOptions={BUFFERS} timezone={TZ} onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: 'Record buffer level' })).toBeTruthy();
    fillLevel();
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'Buffer level recorded' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('save-failure-alert')).toBeNull();
  });

  it('a refused level is the red alert at the top, the input kept', async () => {
    reply = (call) => (call.method === 'POST' ? jsonResponse(403, errorBody('FORBIDDEN_ROLE', 'role')) : undefined);
    const onClose = vi.fn();
    wrap(<BufferLevelDialog bufferOptions={BUFFERS} timezone={TZ} onClose={onClose} />);
    fillLevel();
    const alert = await screen.findByTestId('save-failure-alert');
    expect(screen.getByTestId('buffer-level-form').firstElementChild).toBe(alert);
    expect((screen.getByLabelText('Buffer') as HTMLSelectElement).value).toBe('u1|u2');
    expect(onClose).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  it('Buffer levels: the table first, "Record buffer level" in the section header opens the dialog', async () => {
    reply = (call) => (call.method === 'GET' ? jsonResponse(200, { items: [LEVEL], nextCursor: null }) : undefined);
    const refs = { timezone: TZ, unitName: (id: string) => (id === 'u1' ? 'Reactor' : 'Extruder') } as unknown as Parameters<typeof BufferLevelsSection>[0]['refs'];
    wrap(<BufferLevelsSection refs={refs} bufferOptions={BUFFERS} canWrite />);
    expect(await screen.findByRole('table', { name: 'Buffer levels' })).toBeTruthy();
    expect(screen.queryByTestId('buffer-level-form')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Record buffer level' }));
    expect(await screen.findByTestId('buffer-level-form')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByTestId('buffer-level-form')).toBeNull());
  });

  it('Buffer levels: without an approved buffer route the action says why it is disabled; readers get no action', async () => {
    reply = () => jsonResponse(200, { items: [], nextCursor: null });
    const refs = { timezone: TZ, unitName: () => '' } as unknown as Parameters<typeof BufferLevelsSection>[0]['refs'];
    const { unmount } = wrap(<BufferLevelsSection refs={refs} bufferOptions={[]} canWrite />);
    expect(screen.getByRole('button', { name: 'Record buffer level' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByTestId('disabled-reason').textContent).toBe('Approve a route with a buffer first.');
    unmount();
    wrap(<BufferLevelsSection refs={refs} bufferOptions={BUFFERS} canWrite={false} />);
    expect(screen.queryByRole('button', { name: 'Record buffer level' })).toBeNull();
  });

  // Plant & equipment cleanup (25 Oct 2026): ⓘ instead of description paragraphs, h-9, focus the first field, Esc closes
  it('Add route dialog: purpose behind the title ⓘ, focus in "From unit", h-9 fields, Cancel then primary, Esc closes', async () => {
    const onDone = vi.fn();
    wrap(<FlowRouteDialog unitOptions={UNITS} timezone={TZ} onDone={onDone} />);
    const dialog = screen.getByRole('dialog', { name: 'Add route' });
    expect(within(dialog).queryByText(/another user approves it/)).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'About Add route' })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('From unit (supplies)')));
    expect(screen.getByTestId('flow-route-form')).toHaveClass('[&_input]:h-9');
    expect(within(dialog).getAllByRole('button').filter((b) => /^(Cancel|Add draft route)$/.test(b.textContent ?? '')).map((b) => b.textContent)).toEqual(['Cancel', 'Add draft route']);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('Record buffer level dialog: purpose behind ⓘ, 560 px, focus in "Buffer", Esc closes', async () => {
    const onClose = vi.fn();
    wrap(<BufferLevelDialog bufferOptions={BUFFERS} timezone={TZ} onClose={onClose} />);
    const dialog = screen.getByRole('dialog', { name: 'Record buffer level' });
    expect(dialog).toHaveClass('sm:max-w-[560px]');
    expect(within(dialog).queryByText(/within 24 h/)).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'About Record buffer level' })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Buffer')));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Buffer levels: a report-look card with the rule behind ⓘ, read time without the zone', async () => {
    reply = (call) => (call.method === 'GET' ? jsonResponse(200, { items: [LEVEL], nextCursor: null }) : undefined);
    const refs = { timezone: TZ, unitName: (id: string) => (id === 'u1' ? 'Reactor' : 'Extruder') } as unknown as Parameters<typeof BufferLevelsSection>[0]['refs'];
    wrap(<BufferLevelsSection refs={refs} bufferOptions={BUFFERS} canWrite />);
    const table = await screen.findByRole('table', { name: 'Buffer levels' });
    expect(screen.getByTestId('buffer-levels-card')).toHaveClass('rounded-lg', 'border', 'bg-card', 'p-4');
    expect(screen.queryByText(/replaces the configured usable inventory/)).toBeNull();
    expect(screen.getByRole('button', { name: 'About Buffer levels' })).toBeTruthy();
    await waitFor(() => expect(within(table).getByText(/06:00/)).toBeTruthy());
    expect(table.textContent).not.toMatch(/Asia\/Tehran|\+03:30/);
  });

  it('Plant flow page: no header description; Routes card with its ⓘ, own empty message and Add route', async () => {
    wrap(<PlantFlowPage />);
    expect(await screen.findByText('Without routes no stop propagates between units: each unit counts its own losses only.')).toBeTruthy();
    expect(screen.queryByText(/a stop upstream uses the buffer's cover/)).toBeNull();
    const routes = screen.getByTestId('flow-routes-card');
    expect(within(routes).getByRole('button', { name: 'About Routes' })).toBeTruthy();
    expect(within(routes).getByTestId('flow-route-new')).toHaveClass('h-9');
  });

  it('Routes: a draft route keeps Approve, and Retire opens its 420 px confirmation; the effective time has no zone', async () => {
    reply = (call) => (call.method === 'GET' && call.url.pathname === '/api/v2/flow-routes' ? jsonResponse(200, { items: [ROUTE], nextCursor: null }) : undefined);
    wrap(<PlantFlowPage />);
    const row = (await screen.findByTestId('flow-route-row')).closest('tr') as HTMLElement;
    expect(row.textContent).not.toMatch(/Asia\/Tehran|\+03:30/);
    expect(within(row).getByTestId('approve-version')).toBeTruthy();
    fireEvent.click(within(row).getByRole('button', { name: 'Retire' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Retire this flow route?' });
    expect(dialog).toHaveClass('sm:max-w-[420px]');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });
});
