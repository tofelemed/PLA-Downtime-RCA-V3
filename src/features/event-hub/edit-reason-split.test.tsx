import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { ProductionEventView } from '@/api/v2/types/events';
import { DisplayCurrencyContext } from '@/features/display-currency/display-currency-context';
import { actAs } from '@/test/acting-user';
import { EMPTY_FORM, formValuesOf, type EventFormValues } from './model/event-form';
import { EventHubEnvContext, type EventHubEnv } from './use-event-hub-env';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('./hooks/use-asset-options', () => ({ useAssetOptions: () => [] }));
vi.mock('@/features/ux-kit/labels/use-user-names', () => ({ useUserNames: () => ({ nameOf: () => 'A. Karimi', isLoading: false }) }));

const { EventFormFields } = await import('./components/event-form-fields');

const NAMES: Record<string, string> = { r1: 'Motor trip', r2: 'Belt slip' };
const ENV: EventHubEnv = {
  tenantId: 'tenant-a', timezone: 'UTC', timezoneIsFallback: false, units: [{ id: 'u1', code: 'unit100', name: 'Extruder Line 1', siteId: null }],
  unitsLoading: false, reasonCodes: [], allReasonCodes: [], unitName: () => 'Extruder Line 1', reasonName: (id) => (id ? (NAMES[id] ?? '—') : '—'), unitCode: () => 'unit100',
};
const SPLIT_STOP = {
  id: 'e1', unitId: 'u1', assetId: null, startTime: '2026-10-15T06:00:00.000Z', endTime: '2026-10-15T07:00:00.000Z', isOpen: false, durationSeconds: 3600, elapsedSeconds: 3600,
  asOf: '2026-10-15T09:00:00.000Z', sourceKind: 'manual', source: null, overriddenFields: [], sourceOwnedFields: [],
  classification: { physicalType: 'downtime', scheduleClass: 'unplanned', oeeComponent: 'availability', impactMode: 'full_stop', impactFraction: null },
  states: { physical: 'closed', coding: 'coded', rca: 'none' }, rowVersion: 3, description: null, reasonCodeId: 'r1',
  reasonWeights: [{ reasonCodeId: 'r1', weight: '0.60000000' }, { reasonCodeId: 'r2', weight: '0.40000000' }],
} as unknown as ProductionEventView;
const SINGLE_STOP = { ...SPLIT_STOP, reasonWeights: null } as unknown as ProductionEventView;

let client: QueryClient;
const wrap = (node: ReactNode) =>
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <DisplayCurrencyContext.Provider value={{ currency: 'USD', setCurrency: () => undefined }}>
          <EventHubEnvContext.Provider value={ENV}>{node}</EventHubEnvContext.Provider>
        </DisplayCurrencyContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );

/** The edit (or new) form over local state, as the page's draft hook would hold it. */
function Form({ event }: { event: ProductionEventView | null }) {
  const [values, setValues] = useState<EventFormValues>(() => (event ? formValuesOf(event, 'UTC') : { ...EMPTY_FORM, unitId: 'u1' }));
  const [initial] = useState(values);
  const setField = <F extends keyof EventFormValues>(field: F, value: EventFormValues[F]) => setValues((v) => ({ ...v, [field]: value }));
  const form = { values, errors: {}, setField, draft: { initial, values, baseRevision: event?.rowVersion ?? null } };
  return (
    <>
      <EventFormFields form={form as unknown as Parameters<typeof EventFormFields>[0]['form']} mode={event ? 'edit' : 'create'} event={event} />
      <output data-testid="note-state">{values.codingNote}</output>
    </>
  );
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ items: [], nextCursor: null }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
});
afterEach(() => {
  vi.unstubAllGlobals();
  actAs('SuperAdmin');
});

const shares = () => (screen.getAllByTestId('split-value') as HTMLInputElement[]).map((input) => input.value);

describe('edit page: several reasons and the coding note (D-T5, owner decision 2026-10-30)', () => {
  it('lets a production engineer edit the stored split row by row, with the single picker back once it is unticked', () => {
    actAs('production_engineer');
    wrap(<Form event={SPLIT_STOP} />);
    expect(screen.getByTestId('split-enabled')).toHaveAttribute('data-state', 'checked');
    expect(shares()).toEqual(['60', '40']);
    expect(document.getElementById('reasonCodeId')).toBeNull();
    fireEvent.change(screen.getAllByTestId('split-value')[0], { target: { value: '70' } });
    expect(shares()).toEqual(['70', '40']);
    fireEvent.click(screen.getByText('Add reason'));
    expect(screen.getAllByTestId('split-row')).toHaveLength(3);
    fireEvent.click(screen.getByTestId('split-enabled'));
    expect(screen.queryByTestId('split-value')).toBeNull();
    expect(document.getElementById('reasonCodeId')).not.toBeNull();
  });

  it('shows an operator the stored split as it is, closed to them, and still takes their note', () => {
    actAs('operator');
    wrap(<Form event={SPLIT_STOP} />);
    expect(screen.getByTestId('split-locked')).toHaveTextContent('Motor trip');
    expect(screen.getByTestId('split-locked')).toHaveTextContent('A production engineer, reliability engineer or manager changes its reasons');
    expect(screen.queryByTestId('reason-split')).toBeNull();
    expect(document.getElementById('reasonCodeId')).toBeNull();
    const note = screen.getByLabelText('Coding note (optional, in your own words)') as HTMLTextAreaElement;
    fireEvent.change(note, { target: { value: 'Belt slipped after the trip' } });
    expect(screen.getByTestId('note-state')).toHaveTextContent('Belt slipped after the trip');
  });

  it('offers an operator one reason and the note on a single-reason stop, and no split', () => {
    actAs('operator');
    wrap(<Form event={SINGLE_STOP} />);
    expect(document.getElementById('reasonCodeId')).not.toBeNull();
    expect(screen.queryByTestId('reason-split')).toBeNull();
    expect(screen.getByTestId('form-coding-note')).toBeInTheDocument();
  });

  it('offers the split on edit only: a new event has the note and one reason', () => {
    actAs('production_engineer');
    wrap(<Form event={SINGLE_STOP} />);
    expect(screen.getByTestId('reason-split')).toBeInTheDocument();
    expect(screen.getByTestId('split-enabled')).toHaveAttribute('data-state', 'unchecked');
    wrap(<Form event={null} />);
    expect(screen.getAllByTestId('reason-split')).toHaveLength(1);
    expect(screen.getAllByTestId('form-coding-note')).toHaveLength(2);
  });
});
