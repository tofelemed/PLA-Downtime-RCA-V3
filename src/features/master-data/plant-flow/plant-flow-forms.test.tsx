import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { actAs } from '@/test/acting-user';
import { errorBody, jsonResponse, stubV2Fetch, type V2Call } from '@/test/v2-fetch';

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { FlowRouteForm } = await import('./flow-route-form');
const { BufferLevelForm } = await import('./buffer-level-form');

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

  it('an added route ends in a toast and the form closes', async () => {
    reply = (call) => (call.method === 'POST' ? jsonResponse(201, ROUTE) : undefined);
    const onDone = vi.fn();
    wrap(<FlowRouteForm unitOptions={UNITS} timezone={TZ} onDone={onDone} />);
    fillRoute();
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'Draft route added' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('a refused route is the red alert at the top of the form, the input kept, no toast', async () => {
    reply = (call) => (call.method === 'POST' ? jsonResponse(422, errorBody('FLOW_ROUTE_CYCLE', 'cycle')) : undefined);
    const onDone = vi.fn();
    wrap(<FlowRouteForm unitOptions={UNITS} timezone={TZ} onDone={onDone} />);
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

  it('a recorded level ends in a toast and an empty form', async () => {
    reply = (call) => (call.method === 'POST' ? jsonResponse(201, LEVEL) : undefined);
    wrap(<BufferLevelForm bufferOptions={BUFFERS} timezone={TZ} />);
    fillLevel();
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'Buffer level recorded' }));
    expect((screen.getByLabelText('Buffer') as HTMLSelectElement).value).toBe('');
    expect(screen.queryByTestId('save-failure-alert')).toBeNull();
  });

  it('a refused level is the red alert at the top, the input kept', async () => {
    reply = (call) => (call.method === 'POST' ? jsonResponse(403, errorBody('FORBIDDEN_ROLE', 'role')) : undefined);
    wrap(<BufferLevelForm bufferOptions={BUFFERS} timezone={TZ} />);
    fillLevel();
    const alert = await screen.findByTestId('save-failure-alert');
    expect(screen.getByTestId('buffer-level-form').firstElementChild).toBe(alert);
    expect((screen.getByLabelText('Buffer') as HTMLSelectElement).value).toBe('u1|u2');
    expect(toast).not.toHaveBeenCalled();
  });
});
