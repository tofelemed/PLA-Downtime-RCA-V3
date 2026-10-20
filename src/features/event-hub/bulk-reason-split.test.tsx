import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { BulkTarget } from '@/api/v2/types/events';
import { EventHubEnvContext, type EventHubEnv } from './use-event-hub-env';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { BulkCodeDialog } = await import('./components/bulk-code-dialog');
const { toBulkBody } = await import('./hooks/use-bulk-code-flow');

const ENV: EventHubEnv = {
  tenantId: 'tenant-a', timezone: 'UTC', timezoneIsFallback: false, units: [], unitsLoading: false, reasonCodes: [], allReasonCodes: [],
  unitName: () => 'Extruder 1', reasonName: () => '—',
};
const EVENTS = [
  { id: 'e1', rowVersion: 1, unitId: 'u1', startTime: '2026-10-15T06:00:00.000Z', endTime: '2026-10-15T07:00:00.000Z' },
  { id: 'e2', rowVersion: 4, unitId: 'u1', startTime: '2026-10-15T08:00:00.000Z', endTime: '2026-10-15T08:30:00.000Z' },
] as BulkTarget[];
const NO_CODES = { reasonCodeId: '', scheduleClass: '', oeeComponent: '', assetId: '', investigationPending: 'unchanged' as const };

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ items: [], nextCursor: null }), { status: 200, headers: { 'Content-Type': 'application/json' } })),
  );
  configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
});
afterEach(() => vi.unstubAllGlobals());

describe('bulk coding: split across several reasons (D-T5)', () => {
  it('sends the percents as codes.reasonWeights and leaves reasonCodeId to the server', () => {
    const reasonWeights = [
      { reasonCodeId: 'r1', percent: '60' },
      { reasonCodeId: 'r2', percent: '40' },
    ];
    const body = toBulkBody(EVENTS, { ...NO_CODES, reasonCodeId: 'r9', scheduleClass: 'unplanned', reasonWeights }, ' why ', true);
    expect(body).toEqual({
      items: [{ eventId: 'e1', expectedVersion: 1 }, { eventId: 'e2', expectedVersion: 4 }],
      codes: { reasonWeights, scheduleClass: 'unplanned' },
      reason: 'why',
      preview: true,
    });
    expect(toBulkBody(EVENTS, { ...NO_CODES, reasonCodeId: 'r9' }, 'x', true).codes).toEqual({ reasonCodeId: 'r9' });
  });

  it('offers percent only, without the minutes option, and asks for a complete split before Preview', () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <EventHubEnvContext.Provider value={ENV}>
            <BulkCodeDialog events={EVENTS} onClose={() => undefined} />
          </EventHubEnvContext.Provider>
        </QueryClientProvider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('split-enabled'));
    expect(screen.getAllByTestId('split-row')).toHaveLength(2);
    expect(screen.getByTestId('split-percent-only')).toHaveTextContent('Bulk coding splits by percent');
    expect(screen.queryByRole('radio', { name: /Minutes/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled();
    expect(screen.getByText(/every row of the split/)).toBeInTheDocument();
  });
});
