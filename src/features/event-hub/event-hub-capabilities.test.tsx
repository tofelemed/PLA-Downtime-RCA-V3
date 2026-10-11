import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { configureV2Session } from '@/api/v2/config';
import type { EventReviewItemView } from '@/api/v2/types/events';
import { actAs } from '@/test/acting-user';
import { defaultFilters } from './model/event-filters';
import { EventHubEnvContext, type EventHubEnv } from './use-event-hub-env';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { ReviewItemsList } = await import('./components/review-items-list');
const { CurrentStopsPanel } = await import('./components/current-stops-panel');

const ENV: EventHubEnv = {
  tenantId: 'tenant-a', timezone: 'UTC', timezoneIsFallback: false, units: [], unitsLoading: false, reasonCodes: [],
  unitName: () => 'Unit 1', reasonName: () => '—',
};
const WINDOW = { from: '2026-10-09T00:00:00.000Z', to: '2026-10-10T00:00:00.000Z', label: 'Test window' };
const EVENT = { id: 'e1', rowVersion: 1, startTime: '2026-10-09T06:00:00.000Z', endTime: null };
const ITEM: EventReviewItemView = { id: 'ri1', eventId: 'e1', kind: 'source_conflict', field: 'reasonCodeId', state: 'open', resolvedBy: null, resolvedAt: null, createdAt: '2026-10-09T07:00:00.000Z' };
const STOP = {
  id: 'e1', unitId: 'u1', startTime: '2026-10-09T06:00:00.000Z', endTime: null, isOpen: true, durationSeconds: null, elapsedSeconds: 600, asOf: '2026-10-09T06:10:00.000Z',
  classification: { physicalType: 'downtime' }, states: { physical: 'open', coding: 'uncoded', rca: 'none' }, reasonCodeId: null, rowVersion: 1,
};

describe('Event Hub v2: event commands for every non-viewer member (canWriteEvents)', () => {
  let client: QueryClient;
  const wrap = (node: ReactNode) =>
    render(
      <QueryClientProvider client={client}>
        <EventHubEnvContext.Provider value={ENV}>{node}</EventHubEnvContext.Provider>
      </QueryClientProvider>,
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

  it('an engineer can close a running stop; a viewer only opens it', async () => {
    actAs('Engineer');
    const engineer = wrap(<CurrentStopsPanel filters={defaultFilters(WINDOW)} onOpen={() => undefined} onClose={() => undefined} />);
    await waitFor(() => expect(screen.getByTestId('current-stop-close')).toBeTruthy());
    engineer.unmount();
    actAs('viewer');
    wrap(<CurrentStopsPanel filters={defaultFilters(WINDOW)} onOpen={() => undefined} onClose={() => undefined} />);
    await waitFor(() => expect(screen.getByTestId('current-stop')).toBeTruthy());
    expect(screen.queryByTestId('current-stop-close')).toBeNull();
  });
});
