import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { EventReviewItemView } from '@/api/v2/types/events';
import { actAs } from '@/test/acting-user';
import { EventHubEnvContext, type EventHubEnv } from './use-event-hub-env';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { ReviewItemsList } = await import('./components/review-items-list');
const { CurrentStopsPanel } = await import('./components/current-stops-panel');
const { EventsReadOnlyHint } = await import('./components/events-read-only-hint');

const ENV: EventHubEnv = {
  tenantId: 'tenant-a', timezone: 'UTC', timezoneIsFallback: false, units: [], unitsLoading: false, reasonCodes: [],
    allReasonCodes: [],
  unitName: () => 'Unit 1', reasonName: () => '—',
};
const EVENT = { id: 'e1', rowVersion: 1, startTime: '2026-10-09T06:00:00.000Z', endTime: null };
const ITEM: EventReviewItemView = { id: 'ri1', eventId: 'e1', kind: 'source_vs_override_conflict', field: 'reasonCodeId', state: 'open', resolvedBy: null, resolvedAt: null, createdAt: '2026-10-09T07:00:00.000Z' };
const STOP = {
  id: 'e1', unitId: 'u1', startTime: '2026-10-09T06:00:00.000Z', endTime: null, isOpen: true, durationSeconds: null, elapsedSeconds: 600, asOf: '2026-10-09T06:10:00.000Z',
  classification: { physicalType: 'downtime' }, states: { physical: 'open', coding: 'uncoded', rca: 'none' }, reasonCodeId: null, rowVersion: 1,
};

describe('Event Hub v2: event commands for the event writers (canWriteEvents)', () => {
  let client: QueryClient;
  const wrap = (node: ReactNode) =>
    render(
      <MemoryRouter>
        <QueryClientProvider client={client}>
          <EventHubEnvContext.Provider value={ENV}>{node}</EventHubEnvContext.Provider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const page = { items: [STOP], nextCursor: null, asOf: STOP.asOf, scope: { tenantId: 'tenant-a' } };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(page), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin');
  });

  it('an operator resolves review items; a viewer sees the items without decisions', () => {
    actAs('Operator');
    const operator = wrap(<ReviewItemsList event={EVENT} items={[ITEM]} />);
    expect(screen.getByText('Keep my value')).toBeTruthy();
    operator.unmount();
    actAs('viewer');
    wrap(<ReviewItemsList event={EVENT} items={[ITEM]} />);
    expect(screen.getByTestId('review-items')).toBeTruthy();
    expect(screen.queryByText('Keep my value')).toBeNull();
  });

  it('owner decision 2026-10-19: the production accountant reads stops and review items but cannot code or decide', async () => {
    actAs('production_accountant');
    const items = wrap(<ReviewItemsList event={EVENT} items={[ITEM]} />);
    expect(screen.queryByText('Keep my value')).toBeNull();
    items.unmount();
    const stops = wrap(<CurrentStopsPanel unitIds={[]} onClose={() => undefined} onCode={() => undefined} />);
    await waitFor(() => expect(screen.getByTestId('current-stop')).toBeTruthy());
    expect(screen.queryByTestId('current-stop-close')).toBeNull();
    stops.unmount();
    wrap(<EventsReadOnlyHint />);
    expect(screen.getByTestId('events-read-only-hint')).toHaveTextContent('read-only for your role');
  });

  it('an engineer can close a running stop; a viewer only opens it', async () => {
    actAs('Engineer');
    const engineer = wrap(<CurrentStopsPanel unitIds={[]} onClose={() => undefined} />);
    await waitFor(() => expect(screen.getByTestId('current-stop-close')).toBeTruthy());
    engineer.unmount();
    actAs('viewer');
    wrap(<CurrentStopsPanel unitIds={[]} onClose={() => undefined} />);
    await waitFor(() => expect(screen.getByTestId('current-stop')).toBeTruthy());
    expect(screen.queryByTestId('current-stop-close')).toBeNull();
  });
});
