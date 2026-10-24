import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { ProductionEventView } from '@/api/v2/types/events';
import type { ShiftInstanceView } from '@/api/v2/types/units';
import { actAs } from '@/test/acting-user';
import { EMPTY_FORM, type EventFormValues } from './model/event-form';
import { EventHubEnvContext, type EventHubEnv } from './use-event-hub-env';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
const shifts: { items: ShiftInstanceView[] } = { items: [] };
vi.mock('@/api/v2/queries/units', () => ({
  useShiftInstances: (query: unknown) => ({ data: query ? { pages: [{ items: shifts.items }] } : undefined }),
}));
vi.mock('./hooks/use-asset-options', () => ({
  useAssetOptions: (unitIds: readonly string[]) => (unitIds.length > 0 ? [{ value: 'a1', label: 'Extruder 1' }] : []),
}));
vi.mock('@/features/ux-kit/labels/use-user-names', () => ({ useUserNames: () => ({ nameOf: () => 'A. Karimi', isLoading: false }) }));
vi.mock('./components/code-event-dialog', () => ({
  CodeEventDialog: ({ onDone }: { onDone: () => void }) => <button onClick={onDone}>finish code</button>,
}));
vi.mock('./components/bulk-code-dialog', () => ({
  BulkCodeDialog: ({ onApplied }: { onApplied?: () => void }) => <button onClick={() => onApplied?.()}>finish bulk</button>,
}));

const { EventFormFields } = await import('./components/event-form-fields');
const { WindowSelect } = await import('./components/window-select');
const { EventListDialogs } = await import('./components/event-list-dialogs');
const { SourceOverrideBanner } = await import('./components/source-override-banner');
const { VerificationChip } = await import('./components/verification-chip');
const { UnitLabel } = await import('./components/unit-label');
const { SplitDialog } = await import('./components/split-dialog');
const { eventColumns } = await import('./components/event-columns');
const { useEventForm } = await import('./hooks/use-event-form');
const { useWindowClock } = await import('./hooks/use-window-clock');
const { draftKey, draftStore } = await import('./model/event-draft');
const { customRangeProblem } = await import('./model/custom-range');
const { startedShifts } = await import('./hooks/use-shift-windows');

const ENV: EventHubEnv = {
  tenantId: 'tenant-a', timezone: 'UTC', timezoneIsFallback: false, units: [{ id: 'u1', code: 'unit100', name: 'Extruder Line 1', siteId: null }],
  unitsLoading: false, reasonCodes: [], allReasonCodes: [], unitName: (id) => (id === 'u1' ? 'Extruder Line 1' : 'Unit 2'), reasonName: () => '—',
  unitCode: (id) => (id === 'u1' ? 'unit100' : null),
};
const STOP = {
  id: 'e1', unitId: 'u1', assetId: 'a1', startTime: '2026-10-15T06:00:00.000Z', endTime: '2026-10-15T08:00:00.000Z', isOpen: false,
  durationSeconds: 7200, elapsedSeconds: 7200, asOf: '2026-10-15T09:00:00.000Z', sourceKind: 'source', source: 'PI', overriddenFields: ['endTime'],
  classification: { physicalType: 'downtime', scheduleClass: 'unplanned' }, states: { physical: 'closed', coding: 'uncoded', rca: 'none' },
  verification: { verifiedBy: 'user-9', verifiedAt: '2026-10-15T10:00:00.000Z', validatedBy: null, validatedAt: null }, rowVersion: 2,
} as unknown as ProductionEventView;

let client: QueryClient;
const wrap = (node: ReactNode) =>
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <EventHubEnvContext.Provider value={ENV}>{node}</EventHubEnvContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );

function Form({ mode, initial = EMPTY_FORM, event = null }: { mode: 'create' | 'edit'; initial?: EventFormValues; event?: ProductionEventView | null }) {
  const [values, setValues] = useState<EventFormValues>(initial);
  const setField = <F extends keyof EventFormValues>(field: F, value: EventFormValues[F]) => setValues((v) => ({ ...v, [field]: value }));
  return (
    <>
      <EventFormFields form={{ values, errors: {}, setField } as unknown as Parameters<typeof EventFormFields>[0]['form']} mode={mode} event={event} />
      <output data-testid="values">{JSON.stringify(values)}</output>
    </>
  );
}
const valuesShown = () => JSON.parse(screen.getByTestId('values').textContent ?? '{}') as EventFormValues;

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  shifts.items = [];
  window.localStorage.clear();
  const page = { items: [], nextCursor: null, asOf: '2026-10-15T09:00:00.000Z', scope: { tenantId: 'tenant-a' } };
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(page), { status: 200, headers: { 'Content-Type': 'application/json' } })));
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  actAs('Engineer');
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  actAs('SuperAdmin');
});

describe('event form (A-1, E-3, E-4)', () => {
  it('a stop shows its reason first, with "Investigation pending"; other kinds keep it last', () => {
    const { unmount } = wrap(<Form mode="create" />);
    const order = [...document.querySelectorAll('[data-testid="reason-fields"], #unitId')].map((node) => node.id || node.getAttribute('data-testid'));
    expect(order).toEqual(['reason-fields', 'unitId']);
    fireEvent.click(screen.getByTestId('form-investigation-pending'));
    expect(valuesShown().investigationPending).toBe(true);
    unmount();
    wrap(<Form mode="create" initial={{ ...EMPTY_FORM, physicalType: 'quality_loss' }} />);
    const later = [...document.querySelectorAll('[data-testid="reason-fields"], #unitId')].map((node) => node.id || node.getAttribute('data-testid'));
    expect(later).toEqual(['unitId', 'reason-fields']);
    expect(screen.queryByTestId('form-investigation-pending')).toBeNull();
  });

  it('A-1: the asset picker lists the chosen unit\'s assets and resets when the unit changes', () => {
    wrap(<Form mode="create" />);
    expect(screen.getByLabelText('Asset')).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/^Unit/), { target: { value: 'u1' } });
    fireEvent.change(screen.getByLabelText('Asset'), { target: { value: 'a1' } });
    expect(valuesShown().assetId).toBe('a1');
    fireEvent.change(screen.getByLabelText(/^Unit/), { target: { value: '' } });
    expect(valuesShown().assetId).toBe('');
  });

  it('E-4: end time or duration is an explicit choice; the typed end is kept, the server duration is shown', () => {
    const initial = { ...EMPTY_FORM, unitId: 'u1', startLocal: '2026-10-15T06:00', endLocal: '2026-10-15T08:00' };
    wrap(<Form mode="edit" initial={initial} event={STOP} />);
    expect(screen.getByTestId('server-duration')).toHaveTextContent('Current duration (server): 2 h');
    expect(document.getElementById('durationMinutes')).toBeNull();
    fireEvent.click(screen.getByTestId('interval-mode-duration'));
    expect(screen.queryByTestId('field-endLocal')).toBeNull();
    fireEvent.change(document.getElementById('durationMinutes') as HTMLElement, { target: { value: '2h 30m' } });
    expect(valuesShown()).toMatchObject({ intervalMode: 'duration', durationMinutes: '2h 30m', endLocal: '2026-10-15T08:00' });
  });
});

describe('window select (E-2)', () => {
  const instance = (name: string, start: string, end: string): ShiftInstanceView => ({
    id: name, unitId: 'u1', localDate: start.slice(0, 10), shiftName: name, utcStart: start, utcEnd: end, durationSeconds: 28_800, localStart: start, localEnd: end, isExcluded: false,
  });

  it('explains why shifts are hidden without exactly one unit in the ⓘ of the Window label, not as toolbar text', () => {
    const { unmount } = wrap(<WindowSelect unitIds={['u1', 'u2']} label="Last 24 h" bounds={{ from: null, to: null }} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Window')).toBe(screen.getByTestId('event-window'));
    expect(screen.getByRole('button', { name: 'About Window' })).toBeInTheDocument();
    expect(screen.queryByText(/one unit at a time|Choose one unit to pick a shift/)).toBeNull();
    unmount();
    wrap(<WindowSelect unitIds={['u1']} label="Last 24 h" bounds={{ from: null, to: null }} onChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'About Window' })).toBeNull();
  });

  it('offers the current shift of the one unit and rolling presets kept relative', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-18T09:00:00.000Z'));
    shifts.items = [instance('Night', '2026-10-17T22:00:00.000Z', '2026-10-18T06:00:00.000Z'), instance('Morning', '2026-10-18T06:00:00.000Z', '2026-10-18T14:00:00.000Z')];
    const onChange = vi.fn();
    wrap(<WindowSelect unitIds={['u1']} label="Last 24 h" bounds={{ from: null, to: null }} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('event-window'), { target: { value: 'current-shift' } });
    expect(onChange).toHaveBeenLastCalledWith({ from: '2026-10-18T06:00:00.000Z', to: '2026-10-18T14:00:00.000Z', label: 'Current shift (Morning)' });
    fireEvent.change(screen.getByTestId('event-window'), { target: { value: 'preset:8h' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ label: 'Last 8 h', relative: '8h' }));
  });

  it('applies a custom range on the plant clock as explicit bounds', async () => {
    const onChange = vi.fn();
    wrap(<WindowSelect unitIds={[]} label="Last 24 h" bounds={{ from: '2026-10-17T06:00:00.000Z', to: '2026-10-18T06:00:00.000Z' }} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('event-window-custom'));
    fireEvent.change(await screen.findByLabelText('From time'), { target: { value: '08:00' } });
    fireEvent.click(screen.getByTestId('event-window-custom-apply'));
    expect(onChange).toHaveBeenCalledWith({ from: '2026-10-17T08:00:00.000Z', to: '2026-10-18T06:00:00.000Z', label: 'Custom range' });
  });

  it('QA audit L3: "Apply range" stays disabled while the typed range is reversed', async () => {
    const onChange = vi.fn();
    wrap(<WindowSelect unitIds={[]} label="Last 24 h" bounds={{ from: '2026-10-17T06:00:00.000Z', to: '2026-10-17T08:00:00.000Z' }} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('event-window-custom'));
    fireEvent.change(await screen.findByLabelText('To time'), { target: { value: '05:00' } });
    expect(screen.getByTestId('event-window-custom-apply')).toBeDisabled();
    expect(screen.getByText('The end must be after the start')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('To time'), { target: { value: '09:00' } });
    expect(screen.getByTestId('event-window-custom-apply')).toBeEnabled();
    expect(onChange).not.toHaveBeenCalled();
    expect(customRangeProblem({ from: '2026-10-18T07:00:00.000Z', to: '2026-10-18T05:00:00.000Z' })).toBe('The end must be after the start');
    expect(customRangeProblem({ from: null, to: '2026-10-18T05:00:00.000Z' })).toMatch(/both/);
  });

  it('QA audit L4: a shift that has not started is not offered', () => {
    const shift = (id: string, utcStart: string) => ({ id, utcStart, utcEnd: utcStart, isExcluded: false }) as ShiftInstanceView;
    const now = Date.parse('2026-10-19T09:00:00.000Z');
    const listed = startedShifts([shift('a', '2026-10-19T02:30:00.000Z'), shift('b', '2026-10-19T10:30:00.000Z'), { ...shift('c', '2026-10-18T02:30:00.000Z'), isExcluded: true }], now);
    expect(listed.map((s) => s.id)).toEqual(['a']);
  });
});

describe('event list (C-9, C-10, E-1, E-6)', () => {
  const context = { unitName: ENV.unitName, reasonName: ENV.reasonName, assetName: () => 'Extruder 1', dateTime: () => '2026-10-15 06:00', listSearch: '', prefetch: () => undefined };

  it('shows the asset under the unit, a Source column, one inline state cell and a start-time sort toggle', () => {
    const onSort = vi.fn();
    const columns = eventColumns({ ...context, sort: { value: 'newest', onChange: onSort } });
    expect(columns.map((c) => c.id)).toEqual(['start', 'duration', 'unit', 'type', 'reason', 'states', 'origin']);
    const cell = (id: string) => columns.find((c) => c.id === id)?.cell(STOP, 0);
    wrap(<table><tbody><tr>{['unit', 'states', 'origin'].map((id) => <td key={id}>{cell(id)}</td>)}</tr></tbody></table>);
    expect(screen.getByTestId('unit-label')).toHaveTextContent('Extruder Line 1unit100');
    expect(screen.getByTestId('unit-label')).toHaveAttribute('title', 'Code unit100');
    expect(screen.getByTestId('event-asset')).toHaveTextContent('Extruder 1');
    expect(screen.getByTestId('event-origin')).toHaveTextContent('PI');
    expect(screen.getByTestId('event-origin')).toHaveAttribute('title', 'From a connected source');
    const states = screen.getByTestId('event-state-cell');
    expect(states.className).toContain('flex-wrap');
    expect(within(states).getAllByText(/Ended|Closed|Uncoded|No RCA/).length).toBeGreaterThanOrEqual(2);
    render(<>{columns[0].header}</>);
    fireEvent.click(screen.getByTestId('sort-start'));
    expect(onSort).toHaveBeenCalledWith('oldest');
  });

  it('E-6: a bulk apply drops the selection; a single-row Code keeps the rest of it', () => {
    const onSettled = vi.fn();
    const onEventChanged = vi.fn();
    const props = { selectedEvents: [STOP], onClose: vi.fn(), onSettled, onEventChanged, selection: null, onOpen: vi.fn() };
    const { unmount } = wrap(<EventListDialogs {...props} dialog={{ kind: 'code', event: STOP }} />);
    fireEvent.click(screen.getByText('finish code'));
    expect(onEventChanged).toHaveBeenCalledWith('e1');
    expect(onSettled).not.toHaveBeenCalled();
    unmount();
    wrap(<EventListDialogs {...props} dialog={{ kind: 'bulk' }} />);
    fireEvent.click(screen.getByText('finish bulk'));
    expect(onSettled).toHaveBeenCalledTimes(1);
  });
});

describe('event detail and form context (E-5, E-8, E-9, E-10, C-10)', () => {
  it('E-5: a source-owned stop says changes become overrides and lists what is already overridden', () => {
    const { unmount } = wrap(<SourceOverrideBanner event={STOP} />);
    expect(screen.getByTestId('source-override-banner')).toHaveTextContent('This stop comes from PI; changes to source fields are recorded as overrides');
    expect(screen.getByTestId('overridden-fields')).toHaveTextContent('Already overridden:');
    unmount();
    wrap(<SourceOverrideBanner event={{ ...STOP, sourceKind: 'manual' }} />);
    expect(screen.queryByTestId('source-override-banner')).toBeNull();
  });

  it('E-10: verification is a chip next to the states', () => {
    const { unmount } = wrap(<VerificationChip event={STOP} />);
    expect(screen.getByTestId('verification-chip')).toHaveTextContent('Verified by A. Karimi');
    unmount();
    wrap(<VerificationChip event={{ ...STOP, verification: { verifiedBy: null, verifiedAt: null, validatedBy: null, validatedAt: null } }} />);
    expect(screen.getByTestId('verification-chip')).toHaveTextContent('Not verified');
  });

  it('C-10: a unit without its own name shows no duplicate code', () => {
    wrap(<UnitLabel unitId="u2" />);
    expect(screen.getByTestId('unit-label')).toHaveTextContent('Unit 2');
    expect(screen.getByTestId('unit-label')).not.toHaveAttribute('title');
  });

  it('E-8: the split instant can be typed in plant time, in step with the slider; outside the stop is refused', () => {
    wrap(<SplitDialog event={STOP} onClose={vi.fn()} onDone={vi.fn()} />);
    const time = screen.getByLabelText('Split at (plant time) time');
    expect(time).toHaveValue('07:00');
    fireEvent.change(time, { target: { value: '07:30' } });
    expect(screen.getByTestId('split-preview')).toHaveTextContent('Part 1: 06:00');
    expect(screen.getByTestId('split-preview')).toHaveTextContent('07:30');
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '90');
    // QA audit F6: the drag handle has an accessible name and reads the chosen instant
    expect(screen.getByRole('slider', { name: 'Split at' })).toHaveAttribute('aria-valuetext', expect.stringContaining('07:30'));
    fireEvent.change(time, { target: { value: '09:30' } });
    expect(screen.getByText(/Choose a time inside the stop/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Split' })).toBeDisabled();
  });

  it('E-9: a recent draft of another unit is offered, not imposed; "Resume draft" brings it back', () => {
    const key = draftKey('user-1', 'tenant-a', null);
    draftStore.write(key, { baseRevision: null, initial: EMPTY_FORM, values: { ...EMPTY_FORM, unitId: 'u1', description: 'belt' } });
    const { result } = renderHook(() => useEventForm({ userId: 'user-1', tenantId: 'tenant-a', event: null, timezone: 'UTC', defaults: { unitId: 'u2' } }));
    expect(result.current.values.unitId).toBe('u2');
    expect(result.current.offered?.values.description).toBe('belt');
    act(() => result.current.resumeOffered());
    expect(result.current.values).toMatchObject({ unitId: 'u1', description: 'belt' });
    expect(result.current.offered).toBeNull();
  });

  it('E-9: a new-event draft older than 12 h is dropped', () => {
    const key = draftKey('user-1', 'tenant-a', null);
    window.localStorage.setItem(key, JSON.stringify({ baseRevision: null, initial: EMPTY_FORM, values: { ...EMPTY_FORM, description: 'old' }, savedAt: Date.now() - 13 * 3_600_000 }));
    const { result } = renderHook(() => useEventForm({ userId: 'user-1', tenantId: 'tenant-a', event: null, timezone: 'UTC' }));
    expect(result.current.values.description).toBe('');
    expect(result.current.restored).toBe(false);
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it('A-5: the window clock moves on while active and stands still otherwise', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-18T06:00:00.000Z'));
    const active = renderHook(() => useWindowClock(true));
    const idle = renderHook(() => useWindowClock(false));
    const start = active.result.current[0];
    act(() => vi.advanceTimersByTime(5 * 60_000));
    expect(active.result.current[0] - start).toBe(5 * 60_000);
    expect(idle.result.current[0]).toBe(start);
  });
});
