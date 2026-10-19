import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import { V2ApiError } from '@/api/v2/errors';
import type { EventAttributedLossesView, ProductionEventView } from '@/api/v2/types/events';
import { DisplayCurrencyContext } from '@/features/display-currency/display-currency-context';
import { actAs } from '@/test/acting-user';
import { formValuesOf, type EventFormValues } from './model/event-form';
import { EventHubEnvContext, type EventHubEnv } from './use-event-hub-env';
import type { BulkCodes } from './hooks/use-bulk-code-flow';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('./hooks/use-asset-options', () => ({
  useAssetOptions: (unitIds: readonly string[]) => (unitIds.length > 0 ? [{ value: 'a1', label: 'Extruder 1' }] : []),
}));
vi.mock('@/features/ux-kit/labels/use-user-names', () => ({ useUserNames: () => ({ nameOf: () => 'A. Karimi', isLoading: false }) }));

interface QueryStub<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
}
const losses = vi.hoisted(() => ({ query: null as unknown }));
const periods = vi.hoisted(() => ({ items: [] as unknown[] }));
vi.mock('@/api/v2/queries/production-events', async (original) => ({
  ...(await original<typeof import('@/api/v2/queries/production-events')>()),
  useEventAttributedLosses: () => losses.query,
}));
vi.mock('@/api/v2/queries/period-overview', async (original) => ({
  ...(await original<typeof import('@/api/v2/queries/period-overview')>()),
  usePeriodSummaries: () => ({ data: { pages: [{ items: periods.items }] }, isLoading: false, isError: false, error: null, hasNextPage: false }),
}));

const { ImpactedPeriodsPreview } = await import('./components/impacted-periods-preview');
const { AttributedLossesCard } = await import('./components/attributed-losses-card');
const { DurationSortHeader, StartSortHeader } = await import('./components/event-sort-headers');
const { MinDurationSelect } = await import('./components/min-duration-select');
const { BulkExtraFields } = await import('./components/bulk-extra-fields');
const { BulkReferenceError } = await import('./components/bulk-reference-error');
const { BulkPreviewTable } = await import('./components/bulk-preview-table');
const { EventFormFields } = await import('./components/event-form-fields');
const { EventSummary } = await import('./components/event-summary');

const ENV: EventHubEnv = {
  tenantId: 'tenant-a', timezone: 'UTC', timezoneIsFallback: false, units: [{ id: 'u1', code: 'unit100', name: 'Extruder Line 1', siteId: null }],
  unitsLoading: false, reasonCodes: [], allReasonCodes: [], unitName: (id) => (id === 'u1' ? 'Extruder Line 1' : 'Unit 2'), reasonName: () => '—',
  unitCode: (id) => (id === 'u1' ? 'unit100' : null),
};
const STOP = {
  id: 'e1', unitId: 'u1', assetId: 'a1', startTime: '2026-10-15T06:00:00.000Z', endTime: '2026-10-15T08:00:00.000Z', isOpen: false,
  durationSeconds: 7200, elapsedSeconds: 7200, asOf: '2026-10-15T09:00:00.000Z', sourceKind: 'source', source: 'PI', overriddenFields: [],
  sourceOwnedFields: ['startTime', 'endTime', 'durationSeconds', 'assetId', 'description', 'scheduleClass', 'physicalType'],
  classification: { physicalType: 'downtime', scheduleClass: 'unplanned', oeeComponent: 'availability', impactMode: 'full_stop', impactFraction: null },
  states: { physical: 'closed', coding: 'uncoded', rca: 'none' }, rowVersion: 2, description: null, reasonCodeId: null,
} as unknown as ProductionEventView;

let client: QueryClient;
function Providers({ children, currency = 'USD' }: { children: ReactNode; currency?: 'USD' | 'IRR' }) {
  return (
    <QueryClientProvider client={client}>
      <DisplayCurrencyContext.Provider value={{ currency, setCurrency: () => undefined }}>
        <EventHubEnvContext.Provider value={ENV}>{children}</EventHubEnvContext.Provider>
      </DisplayCurrencyContext.Provider>
    </QueryClientProvider>
  );
}
const wrap = (node: ReactNode, currency: 'USD' | 'IRR' = 'USD') =>
  render(
    <MemoryRouter>
      <Providers currency={currency}>{node}</Providers>
    </MemoryRouter>,
  );

function stub<T>(data: T | undefined, extra: Partial<QueryStub<T>> = {}): QueryStub<T> {
  return { data, isLoading: false, isError: false, error: null, refetch: vi.fn(), ...extra };
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const page = { items: [], nextCursor: null, asOf: '2026-10-15T09:00:00.000Z', scope: { tenantId: 'tenant-a' } };
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(page), { status: 200, headers: { 'Content-Type': 'application/json' } })));
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  actAs('Engineer');
});
afterEach(() => {
  vi.unstubAllGlobals();
  actAs('SuperAdmin');
});

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="probe">{JSON.stringify({ path: location.pathname, search: location.search, state: location.state })}</output>;
}

describe('G-2(a) periods of an event link to their workspace', () => {
  it('links a period with a plan, carries the event as back target, and keeps a plan-less period as text', () => {
    const period = { unitId: 'u1', utcStart: '2026-10-15T06:00:00.000Z', utcEnd: '2026-10-15T14:00:00.000Z', localDate: '2026-10-15', shiftName: 'Day', stateReadiness: 'complete_inputs', isExcluded: false };
    periods.items = [{ ...period, periodId: 'p1', planId: 'plan-1', workflowState: 'in_review' }, { ...period, periodId: 'p2', planId: null, shiftName: 'Night', workflowState: 'none' }];
    render(
      <MemoryRouter initialEntries={['/events/e1?tab=periods']}>
        <Providers>
          <Routes>
            <Route path="/events/:id" element={<ImpactedPeriodsPreview unitId="u1" from={period.utcStart} to={period.utcEnd} />} />
            <Route path="/plans/:planId/periods/:periodId" element={<LocationProbe />} />
          </Routes>
        </Providers>
      </MemoryRouter>,
    );
    const links = screen.getAllByTestId('period-link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', '/plans/plan-1/periods/p1');
    expect(screen.getAllByTestId('impacted-period')[1]).toHaveTextContent('Night');
    // owner finding 2: the period's workflow state in the shared wording, not the display-only readiness
    expect(screen.getAllByTestId('impacted-period-workflow').map((badge) => badge.textContent)).toEqual(['In review', 'Not calculated']);
    fireEvent.click(links[0]);
    expect(JSON.parse(screen.getByTestId('probe').textContent ?? '{}')).toEqual({ path: '/plans/plan-1/periods/p1', search: '', state: { listSearch: '/events/e1?tab=periods' } });
  });
});

const LOSSES: EventAttributedLossesView = {
  eventId: 'e1',
  valuationView: 'contribution_margin',
  truncated: false,
  asOf: '2026-10-15T09:00:00.000Z',
  items: [
    {
      periodId: 'p1', unitId: 'u1', localDate: '2026-10-15', shiftName: 'Day', utcStart: '2026-10-15T06:00:00.000Z', utcEnd: '2026-10-15T14:00:00.000Z',
      planId: 'plan-1', planVersionId: 'pv1', revisionId: 'r1', revision: 1, lifecycle: 'approved', status: 'approved',
      quantities: [{ kind: 'availability', uom: 't', quantity: '12.5', lines: 2 }],
      values: [
        { currency: 'USD', amount: '1500.00', valuedLines: 2, unvaluedLines: 0, provisionalLines: 0, status: 'valued', fxProvisional: false },
        { currency: 'IRR', amount: '63000000', valuedLines: 2, unvaluedLines: 0, provisionalLines: 2, status: 'valued', fxProvisional: true },
      ],
    },
    {
      periodId: 'p2', unitId: 'u1', localDate: '2026-10-16', shiftName: null, utcStart: '2026-10-16T06:00:00.000Z', utcEnd: '2026-10-16T14:00:00.000Z',
      planId: null, planVersionId: null, revisionId: 'r2', revision: 3, lifecycle: 'draft', status: 'provisional',
      quantities: [{ kind: 'performance', uom: 't', quantity: '3', lines: 1 }],
      values: [{ currency: 'USD', amount: null, valuedLines: 1, unvaluedLines: 2, provisionalLines: 0, status: 'mixed', fxProvisional: false }],
    },
  ],
};

describe('G-2(b) attributed losses of an event', () => {
  it('lists each period with its status tone, quantities and the value in the display currency (USD)', () => {
    losses.query = stub(LOSSES);
    wrap(<AttributedLossesCard eventId="e1" />);
    const rows = screen.getAllByTestId('attributed-period');
    expect(rows).toHaveLength(2);
    const approved = within(rows[0]);
    expect(approved.getByTestId('attributed-status')).toHaveTextContent('Approved');
    expect(approved.getByTestId('attributed-status')).toHaveAttribute('data-tone', 'success');
    expect(approved.getByTestId('attributed-period-link')).toHaveAttribute('href', '/plans/plan-1/periods/p1?view=approved');
    expect(approved.getByTestId('attributed-quantity')).toHaveTextContent('Availability: 12.50 t');
    expect(approved.getAllByTestId('attributed-value')).toHaveLength(1);
    expect(approved.getByTestId('attributed-value')).toHaveTextContent('1,500.00 USD');
    const provisional = within(rows[1]);
    expect(provisional.getByTestId('attributed-status')).toHaveAttribute('data-tone', 'warning');
    expect(provisional.queryByTestId('attributed-period-link')).toBeNull();
    expect(provisional.getByTestId('attributed-value')).toHaveTextContent('Not fully valued in USD (2 of 3 lines without a value)');
    expect(screen.getByTestId('attributed-valuation-view')).toHaveTextContent('Contribution margin');
    expect(screen.queryByTestId('attributed-truncated')).toBeNull();
  });

  it('shows IRR when the user switched the display currency, naming a provisional exchange rate', () => {
    losses.query = stub(LOSSES);
    wrap(<AttributedLossesCard eventId="e1" />, 'IRR');
    const first = within(screen.getAllByTestId('attributed-period')[0]);
    expect(first.getByTestId('attributed-value')).toHaveTextContent('63,000,000 IRR');
    expect(first.getByTestId('attributed-fx-provisional')).toHaveTextContent('provisional exchange rate on 2 lines');
  });

  it('says when nothing is valued and when the list was cut by the server', () => {
    const unvalued = { ...LOSSES.items[1], values: [{ currency: 'USD', amount: null, valuedLines: 0, unvaluedLines: 1, provisionalLines: 0, status: 'unvalued' as const, fxProvisional: false }] };
    losses.query = stub({ ...LOSSES, truncated: true, items: [unvalued] });
    wrap(<AttributedLossesCard eventId="e1" />);
    expect(screen.getByTestId('attributed-value')).toHaveTextContent('Not valued in USD (no line has a value yet)');
    expect(screen.getByTestId('attributed-truncated')).toHaveTextContent('Only the earliest periods are listed');
  });

  it('shows the empty, loading and error states', () => {
    losses.query = stub({ ...LOSSES, items: [] });
    const { unmount } = wrap(<AttributedLossesCard eventId="e1" />);
    expect(screen.getByText('No loss attributed to this event yet.')).toBeInTheDocument();
    unmount();
    losses.query = stub(undefined, { isLoading: true });
    const loading = wrap(<AttributedLossesCard eventId="e1" />);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    loading.unmount();
    losses.query = stub(undefined, { isError: true, error: new V2ApiError(500, { code: 'INTERNAL', message: 'x', correlationId: 'c1', retryable: true }) });
    wrap(<AttributedLossesCard eventId="e1" />);
    expect(document.querySelector('[data-state="error"]')).not.toBeNull();
  });
});

describe('E-1 sortable headers and minimum duration', () => {
  it('the Duration header sorts longest first, then shortest; Start shows it no longer sorts', () => {
    const onChange = vi.fn();
    const { unmount } = render(<DurationSortHeader sort={{ value: 'newest', onChange }} />);
    expect(screen.getByTestId('sort-duration')).toHaveAttribute('data-sort', 'none');
    fireEvent.click(screen.getByTestId('sort-duration'));
    expect(onChange).toHaveBeenLastCalledWith('longest');
    unmount();
    render(<><DurationSortHeader sort={{ value: 'longest', onChange }} /><StartSortHeader sort={{ value: 'longest', onChange }} /></>);
    expect(screen.getByTestId('sort-duration')).toHaveAttribute('data-sort', 'longest');
    expect(screen.getByTestId('sort-start')).toHaveAttribute('data-sort', 'none');
    fireEvent.click(screen.getByTestId('sort-duration'));
    expect(onChange).toHaveBeenLastCalledWith('shortest');
    fireEvent.click(screen.getByTestId('sort-start'));
    expect(onChange).toHaveBeenLastCalledWith('newest');
  });

  it('offers ≥ 5 min / ≥ 30 min / ≥ 2 h and keeps a shared non-preset value', () => {
    const onChange = vi.fn();
    const { unmount } = wrap(<MinDurationSelect value={null} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('filter-min-duration'), { target: { value: '1800' } });
    expect(onChange).toHaveBeenLastCalledWith(1800);
    fireEvent.change(screen.getByTestId('filter-min-duration'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
    unmount();
    wrap(<MinDurationSelect value={600} onChange={onChange} />);
    expect(screen.getByTestId('filter-min-duration')).toHaveDisplayValue('≥ 10 min');
  });
});

describe('bulk coding: asset and investigation pending', () => {
  const targets = [
    { id: 'e1', rowVersion: 1, unitId: 'u1', startTime: '2026-10-15T06:00:00.000Z', endTime: null },
    { id: 'e2', rowVersion: 1, unitId: 'u1', startTime: '2026-10-15T07:00:00.000Z', endTime: null },
  ];

  function Extra({ events }: { events: typeof targets }) {
    const [codes, setCodes] = useState<Pick<BulkCodes, 'assetId' | 'investigationPending'>>({ assetId: '', investigationPending: 'unchanged' });
    return (
      <>
        <BulkExtraFields events={events} codes={codes} edit={(key, value) => setCodes((c) => ({ ...c, [key]: value }))} />
        <output data-testid="codes">{JSON.stringify(codes)}</output>
      </>
    );
  }

  it('offers the unit’s assets when every event is of one unit and marks investigation pending', () => {
    wrap(<Extra events={targets} />);
    const select = screen.getByLabelText('Asset');
    expect(select).toBeEnabled();
    fireEvent.change(select, { target: { value: 'a1' } });
    expect(screen.getByTestId('bulk-investigation-unchanged')).toBeChecked();
    fireEvent.click(screen.getByTestId('bulk-investigation-set'));
    expect(JSON.parse(screen.getByTestId('codes').textContent ?? '{}')).toEqual({ assetId: 'a1', investigationPending: 'set' });
  });

  it('can clear investigation pending and go back to leaving it unchanged', () => {
    wrap(<Extra events={targets} />);
    const codesShown = () => JSON.parse(screen.getByTestId('codes').textContent ?? '{}');
    fireEvent.click(screen.getByLabelText('Clear investigation pending'));
    expect(codesShown()).toEqual({ assetId: '', investigationPending: 'clear' });
    fireEvent.click(screen.getByLabelText('Leave unchanged'));
    expect(codesShown()).toEqual({ assetId: '', investigationPending: 'unchanged' });
  });

  it('disables the asset with the reason when the events span several units', () => {
    wrap(<Extra events={[...targets, { ...targets[0], id: 'e3', unitId: 'u2' }]} />);
    expect(screen.getByLabelText('Asset')).toBeDisabled();
    expect(screen.getByText(/belong to several units/)).toBeInTheDocument();
  });

  it('names the events a 422 INVALID_REFERENCE lists, with their ids', () => {
    const error = new V2ApiError(422, { code: 'INVALID_REFERENCE', message: 'x', correlationId: null, retryable: false, details: { eventIds: ['e2', 'gone'] } });
    wrap(<BulkReferenceError error={error} events={targets} />);
    const items = within(screen.getByTestId('bulk-invalid-reference')).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Extruder Line 1');
    expect(items[0]).toHaveTextContent('(e2)');
    expect(items[1]).toHaveTextContent('An event no longer listed (gone)');
  });

  it('previews the asset and the investigation flag before and after when they change', () => {
    const snapshot = { reasonCodeId: null, impactCodeId: null, scheduleClass: 'unplanned', oeeComponent: 'availability', codingState: 'uncoded', assetId: null, investigationPending: false };
    const preview = { count: 1, items: [{ eventId: 'e1', before: snapshot, after: { ...snapshot, investigationPending: true } }], exclusions: [], affectedWindows: [] };
    wrap(<BulkPreviewTable preview={preview} events={targets} show={{ asset: false, investigation: true }} />);
    expect(screen.getByRole('columnheader', { name: 'Investigation pending' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Asset' })).toBeNull();
    expect(screen.getByText('No → Investigation pending')).toBeInTheDocument();
  });

  it('previews a cleared investigation flag as before → after', () => {
    const snapshot = { reasonCodeId: null, impactCodeId: null, scheduleClass: 'unplanned', oeeComponent: 'availability', codingState: 'uncoded', assetId: null, investigationPending: true };
    const preview = { count: 1, items: [{ eventId: 'e1', before: snapshot, after: { ...snapshot, investigationPending: false } }], exclusions: [], affectedWindows: [] };
    wrap(<BulkPreviewTable preview={preview} events={targets} show={{ asset: false, investigation: true }} />);
    expect(screen.getByText('Investigation pending → No')).toBeInTheDocument();
  });

  it('QA audit F5: counts only events whose coding changes and lists the windows apart', () => {
    const snapshot = { reasonCodeId: null, impactCodeId: null, scheduleClass: 'unplanned', oeeComponent: 'availability', codingState: 'uncoded', assetId: null, investigationPending: false };
    const windows = [
      { unitId: 'u1', from: '2026-10-17T08:00:00.000Z', to: '2026-10-17T09:00:00.000Z' },
      { unitId: 'u1', from: '2026-10-18T02:00:00.000Z', to: '2026-10-18T02:30:00.000Z' },
    ];
    const items = [{ eventId: 'e1', before: snapshot, after: snapshot, changed: false }, { eventId: 'e2', before: snapshot, after: snapshot, changed: false }];
    wrap(<BulkPreviewTable preview={{ count: 2, changedCount: 0, items, exclusions: [], affectedWindows: windows }} events={targets} />);
    expect(screen.getByTestId('bulk-preview-count')).toHaveTextContent('0');
    expect(screen.getByTestId('bulk-preview-unchanged')).toHaveTextContent('2');
    expect(screen.getAllByText(/· no change$/)).toHaveLength(2);
    expect(within(screen.getByRole('list', { name: 'Recalculates:' })).getAllByRole('listitem')).toHaveLength(2);
  });
});

function Form({ event }: { event: ProductionEventView }) {
  const [values, setValues] = useState<EventFormValues>(() => formValuesOf(event, 'UTC'));
  const [initial] = useState(values);
  const setField = <F extends keyof EventFormValues>(field: F, value: EventFormValues[F]) => setValues((v) => ({ ...v, [field]: value }));
  const form = { values, errors: {}, setField, draft: { initial, values, baseRevision: event.rowVersion } };
  return <EventFormFields form={form as unknown as Parameters<typeof EventFormFields>[0]['form']} mode="edit" event={event} />;
}

describe('E-5 fields the source owns', () => {
  it('shows the interval read only and locks owned fields until "Override…"', () => {
    wrap(<Form event={STOP} />);
    expect(screen.queryByTestId('field-startLocal')).toBeNull();
    expect(screen.getByTestId('source-interval')).toHaveTextContent('From PI: start, end and duration belong to the source');
    expect(screen.getByTestId('server-duration')).toBeInTheDocument();
    const asset = screen.getByTestId('source-owned-assetId');
    expect(within(asset).getByLabelText('Asset')).toBeDisabled();
    expect(asset).toHaveTextContent('From PI (Asset)');
    fireEvent.click(within(asset).getByTestId('source-override'));
    expect(within(asset).getByLabelText('Asset')).toBeEnabled();
    expect(asset).toHaveTextContent('your change is recorded as an override of the source value');
    expect(within(screen.getByTestId('source-owned-description')).getByLabelText('Description')).toBeDisabled();
  });

  it('Marun E2E 1.5: a source-owned impact names its stored basis (the impact rule), and the OEE component is on the form', () => {
    const classification = { ...STOP.classification, impactBasis: 'unit_rule' };
    wrap(<Form event={{ ...STOP, sourceKind: 'derived', source: 'State engine', classification, sourceOwnedFields: [...STOP.sourceOwnedFields, 'impactMode'] }} />);
    const impact = screen.getByTestId('source-owned-impactMode');
    expect(impact).toHaveTextContent('From the approved impact rule for');
    expect(impact).not.toHaveTextContent('From State engine');
    expect(screen.getByLabelText('OEE component')).toHaveValue('availability');
  });

  it('marks nothing on a manual event', () => {
    wrap(<Form event={{ ...STOP, sourceKind: 'manual', sourceOwnedFields: [] }} />);
    expect(screen.getByTestId('field-startLocal')).toBeInTheDocument();
    expect(screen.queryByTestId('source-interval')).toBeNull();
    expect(screen.queryAllByTestId('source-owned-hint')).toHaveLength(0);
    expect(screen.getByLabelText('Asset')).toBeEnabled();
  });

  it('the summary says which values come from the source', () => {
    wrap(<EventSummary event={STOP} />);
    expect(screen.getByTestId('from-source-startTime')).toHaveTextContent('From PI');
    expect(screen.getByTestId('from-source-assetId')).toHaveTextContent('From PI');
  });

  it('Marun E2E 1.5: names the data source "Source" and shows the failure severity beside the event severity', () => {
    const failure = { mode: null, severity: 'critical', maintainableItem: null, mechanism: null, cause: null, detectionMethod: null };
    wrap(<EventSummary event={{ ...STOP, severity: null, failure }} />);
    expect(screen.getByTestId('event-source')).toHaveTextContent('PI · From a connected source');
    expect(screen.getByTestId('event-severity')).toHaveTextContent('—');
    expect(screen.getByTestId('failure-severity')).toHaveTextContent('Critical');
    expect(screen.getByText('Event severity')).toBeInTheDocument();
    expect(screen.queryByText('Origin')).toBeNull();
  });
});

