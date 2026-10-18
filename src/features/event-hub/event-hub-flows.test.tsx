import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { configureV2Session } from '@/api/v2/config';
import { etagCache } from '@/api/v2/etag-cache';
import { useEventSelection, useProductionEvents } from '@/api/v2/queries/production-events';
import type { ProductionEventView } from '@/api/v2/types/events';
import { TooltipProvider } from '@/components/ui/tooltip';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ session: { tenant: { id: 'tenant-a' } } }) }));
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { StateBadges } = await import('./components/state-badges');
const { useEventForm } = await import('./hooks/use-event-form');
const { useEventFormSubmit } = await import('./hooks/use-event-form-submit');
const { useBulkCodeFlow } = await import('./hooks/use-bulk-code-flow');
const { useCloseStop, useCodeEvent } = await import('./hooks/use-code-and-close');
const { draftKey } = await import('./model/event-draft');
const { defaultFilters, toEventQuery } = await import('./model/event-filters');

type Call = { url: string; init: RequestInit };
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

const TZ = 'UTC';
const event = (rowVersion: number, patch: Partial<ProductionEventView> = {}): ProductionEventView =>
  ({
    id: 'e1',
    unitId: 'u1',
    startTime: '2026-10-09T06:00:00.000Z',
    endTime: '2026-10-09T07:00:00.000Z',
    isOpen: false,
    durationSeconds: 3600,
    elapsedSeconds: 3600,
    asOf: '2026-10-09T08:00:00.000Z',
    classification: { physicalType: 'downtime', scheduleClass: 'unplanned', oeeComponent: 'availability', impactMode: 'full_stop', impactFraction: null },
    states: { physical: 'closed', coding: 'uncoded', rca: 'none' },
    reasonCodeId: null,
    description: null,
    rowVersion,
    ...patch,
  }) as ProductionEventView;

describe('Event Hub v2 flows (plan 3.2)', () => {
  let calls: Call[];
  let responses: Response[];
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  );
  const header = (index: number, name: string) => new Headers(calls[index].init.headers).get(name);
  const body = (index: number) => JSON.parse(String(calls[index].init.body)) as Record<string, unknown>;

  beforeEach(() => {
    calls = [];
    responses = [];
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    etagCache.clear();
    window.localStorage.clear();
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return responses.shift() ?? json(500, { code: 'NO_RESPONSE', message: 'none queued' });
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('combined filters reach the server as repeated parameters (no browser filtering)', async () => {
    responses.push(json(200, { items: [], nextCursor: null, asOf: 'x', scope: { tenantId: 'tenant-a' } }));
    const filters = { ...defaultFilters({ from: '2026-10-08T00:00:00.000Z', to: '2026-10-09T00:00:00.000Z', label: '' }), unitIds: ['u2', 'u1'], codingStates: ['uncoded'], isOpen: 'open' as const };
    renderHook(() => useProductionEvents(toEventQuery(filters), TZ), { wrapper });
    await waitFor(() => expect(calls).toHaveLength(1));
    const url = new URL(calls[0].url);
    expect(url.pathname).toMatch(/\/v2\/production-events$/);
    expect(url.searchParams.getAll('unitIds')).toEqual(['u1', 'u2']);
    expect(url.searchParams.getAll('codingStates')).toEqual(['uncoded']);
    expect(url.searchParams.getAll('physicalStates')).toEqual(['closed', 'open']);
    expect(url.searchParams.get('isOpen')).toBe('true');
    expect(url.searchParams.get('from')).toBe('2026-10-08T00:00:00.000Z');
    expect(url.searchParams.has('tenantId')).toBe(false);
  });

  it('412 opens the conflict review; "apply mine" re-sends the same change with the latest If-Match', async () => {
    const onSaved = vi.fn();
    const { result } = renderHook(() => {
      const form = useEventForm({ userId: 'user-1', tenantId: 'tenant-a', event: event(3), timezone: TZ });
      return { form, save: useEventFormSubmit({ form, event: event(3), timezone: TZ, onSaved }) };
    }, { wrapper });
    act(() => result.current.form.setField('reasonCodeId', 'r1'));
    responses.push(json(412, { code: 'STALE_REVISION', message: 'current revision 5', correlationId: 'c', retryable: false }, { ETag: '"5"' }));
    await act(async () => expect(await result.current.save.submit()).toBe('conflict'));
    expect(result.current.save.conflict).toBe(true);
    expect(header(0, 'If-Match')).toBe('"3"');
    expect(onSaved).not.toHaveBeenCalled();
    responses.push(json(200, event(6, { reasonCodeId: 'r1' })));
    await act(async () => expect(await result.current.save.retryOn(event(5, { description: 'theirs' }))).toBe('saved'));
    expect(header(1, 'If-Match')).toBe('"5"');
    expect(body(1)).toEqual({ reasonCodeId: 'r1' });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ rowVersion: 6 }));
    expect(window.localStorage.getItem(draftKey('user-1', 'tenant-a', 'e1'))).toBeNull();
  });

  it('422 DURATION_CONFLICT lands on the duration input; create sends an Idempotency-Key', async () => {
    const { result } = renderHook(() => {
      const form = useEventForm({ userId: 'user-1', tenantId: 'tenant-a', event: null, timezone: TZ, defaults: { unitId: 'u1' } });
      return { form, save: useEventFormSubmit({ form, event: null, timezone: TZ, onSaved: vi.fn() }) };
    }, { wrapper });
    act(() => {
      result.current.form.setField('startLocal', '2026-10-09T06:00');
      result.current.form.setField('endLocal', '2026-10-09T07:00');
      result.current.form.setField('intervalMode', 'duration');
      result.current.form.setField('durationMinutes', '30');
    });
    responses.push(json(422, { code: 'DURATION_CONFLICT', message: 'mismatch', fieldErrors: [{ field: 'durationSeconds', message: 'Does not match the end' }], correlationId: 'c', retryable: false }));
    await act(async () => expect(await result.current.save.submit()).toBe('failed'));
    expect(result.current.form.errors.durationMinutes).toBe('Does not match the end');
    expect(header(0, 'Idempotency-Key')).toBeTruthy();
    // E-4: the duration is the chosen alternative; the typed end is kept in the form but not sent
    expect(body(0)).toMatchObject({ unitId: 'u1', startTime: '2026-10-09T06:00:00.000Z', durationSeconds: 1800 });
    expect(body(0)).not.toHaveProperty('endTime');
  });

  it('restores an unsaved draft after a reload and flags a server revision change', () => {
    const first = renderHook(() => useEventForm({ userId: 'user-1', tenantId: 'tenant-a', event: event(3), timezone: TZ }), { wrapper });
    act(() => first.result.current.setField('description', 'belt slipped'));
    first.unmount();
    const again = renderHook(() => useEventForm({ userId: 'user-1', tenantId: 'tenant-a', event: event(4), timezone: TZ }), { wrapper });
    expect(again.result.current.restored).toBe(true);
    expect(again.result.current.values.description).toBe('belt slipped');
    expect(again.result.current.serverChanged).toBe(true);
  });

  it('FE-06: closing with a new reason codes first, then closes with the coded row version', async () => {
    const open = event(3, { isOpen: true, endTime: null, states: { physical: 'open', coding: 'uncoded', rca: 'none' } });
    const { result } = renderHook(() => useCloseStop(open), { wrapper });
    responses.push(json(200, { ...open, reasonCodeId: 'r1', rowVersion: 4 }));
    responses.push(json(200, { operation: 'close', createdEventIds: [], supersededEventIds: [], updatedEventIds: ['e1'], occurrenceId: 'e1' }));
    await act(async () => expect(await result.current.submit({ endTime: '2026-10-09T07:00:00.000Z', reason: 'belt fixed', reasonCodeId: 'r1' })).toBe(true));
    expect(calls[0].init.method).toBe('PATCH');
    expect(header(0, 'If-Match')).toBe('"3"');
    expect(body(0)).toEqual({ reasonCodeId: 'r1' });
    expect(calls[1].url).toMatch(/\/production-events\/e1\/close$/);
    expect(header(1, 'If-Match')).toBe('"4"');
    expect(body(1)).toEqual({ endTime: '2026-10-09T07:00:00.000Z', reason: 'belt fixed' });
  });

  it('FE-06: closing without a new reason is one request', async () => {
    const open = event(3, { isOpen: true, endTime: null, reasonCodeId: 'r1' });
    const { result } = renderHook(() => useCloseStop(open), { wrapper });
    responses.push(json(200, { operation: 'close', createdEventIds: [], supersededEventIds: [], updatedEventIds: ['e1'], occurrenceId: 'e1' }));
    await act(async () => expect(await result.current.submit({ endTime: '2026-10-09T07:00:00.000Z', reason: 'ok', reasonCodeId: 'r1' })).toBe(true));
    expect(calls).toHaveLength(1);
    expect(header(0, 'If-Match')).toBe('"3"');
  });

  it('FE-06: the inline Code action sends only the reason code with If-Match', async () => {
    const { result } = renderHook(() => useCodeEvent(event(2)), { wrapper });
    responses.push(json(200, event(3, { reasonCodeId: 'r2' })));
    await act(async () => expect(await result.current.submit({ reasonCodeId: 'r2' })).toBe(true));
    expect(calls[0].init.method).toBe('PATCH');
    expect(header(0, 'If-Match')).toBe('"2"');
    expect(body(0)).toEqual({ reasonCodeId: 'r2' });
  });

  it('SME D12: "investigation pending" is saved without a reason code', async () => {
    const { result } = renderHook(() => useCodeEvent(event(2)), { wrapper });
    responses.push(json(200, event(3, { investigationPending: true })));
    await act(async () => expect(await result.current.submit({ investigationPending: true })).toBe(true));
    expect(body(0)).toEqual({ investigationPending: true });
  });

  it('SME D13: "all matching" reads a server snapshot with the list filters and the window', async () => {
    const query = { from: '2026-10-01T00:00:00.000Z', to: '2026-10-08T00:00:00.000Z', unitIds: ['u1'], codingStates: ['uncoded' as const] };
    responses.push(json(200, { count: 1, firstStart: null, lastEnd: null, unitIds: ['u1'], assetCount: 0, items: [{ id: 'e1', rowVersion: 2 }] }));
    const { result } = renderHook(() => useEventSelection(query), { wrapper });
    await waitFor(() => expect(result.current.data?.count).toBe(1));
    const url = new URL(calls[0].url);
    expect(url.pathname).toMatch(/\/v2\/production-events\/selection$/);
    expect(url.searchParams.getAll('codingStates')).toEqual(['uncoded']);
    expect(url.searchParams.get('from')).toBe(query.from);
  });

  it('bulk coding: preview first, then apply; above the atomic limit the job is followed', async () => {
    const events = [event(1), event(2, { id: 'e2' })];
    const { result } = renderHook(() => useBulkCodeFlow(events), { wrapper });
    act(() => {
      result.current.edit('reasonCodeId', 'r1');
      result.current.setReason('same cause');
    });
    responses.push(json(200, { count: 2, items: [], exclusions: [], affectedWindows: [] }));
    await act(() => result.current.preview());
    expect(body(0)).toEqual({ items: [{ eventId: 'e1', expectedVersion: 1 }, { eventId: 'e2', expectedVersion: 2 }], codes: { reasonCodeId: 'r1' }, reason: 'same cause', preview: true });
    expect(result.current.step.kind).toBe('preview');
    responses.push(json(202, { jobId: 'j1', statusUrl: '/api/v2/jobs/j1' }));
    await act(() => result.current.apply());
    expect(body(1).preview).toBe(false);
    expect(result.current.step).toEqual({ kind: 'job', jobId: 'j1' });
  });

  it('state badges carry text labels for every dimension', () => {
    render(<StateBadges states={{ physical: 'open', coding: 'coded', rca: 'required' }} />, { wrapper });
    expect(screen.getByLabelText('Physical state: Ongoing')).toBeTruthy();
    expect(screen.getByLabelText('Coding state: Coded')).toBeTruthy();
    expect(screen.getByLabelText('RCA state: RCA required')).toBeTruthy();
  });
});
