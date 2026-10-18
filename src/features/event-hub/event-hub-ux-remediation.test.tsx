import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { ProductionEventView } from '@/api/v2/types/events';
import { actAs } from '@/test/acting-user';
import { EMPTY_FORM, type EventFormValues } from './model/event-form';
import { EventHubEnvContext, type EventHubEnv } from './use-event-hub-env';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { CodeEventDialog } = await import('./components/code-event-dialog');
const { CurrentStopsPanel } = await import('./components/current-stops-panel');
const { EventFormFields } = await import('./components/event-form-fields');

const ENV: EventHubEnv = {
  tenantId: 'tenant-a', timezone: 'Asia/Tehran', timezoneIsFallback: false, units: [], unitsLoading: false, reasonCodes: [], allReasonCodes: [],
  unitName: () => 'Unit 1', reasonName: () => '—',
};
const STOP = {
  id: 'e1', unitId: 'u1', startTime: '2026-10-09T06:00:00.000Z', endTime: null, isOpen: true, durationSeconds: null, elapsedSeconds: 212_640,
  asOf: '2026-10-11T17:04:00.000Z', classification: { physicalType: 'downtime' }, states: { physical: 'open', coding: 'uncoded', rca: 'none' },
  reasonCodeId: null, rowVersion: 1,
};
const eventOf = (physicalType: string) => ({ ...STOP, classification: { physicalType } }) as unknown as ProductionEventView;

let client: QueryClient;
const wrap = (node: ReactNode) =>
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <EventHubEnvContext.Provider value={ENV}>{node}</EventHubEnvContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );

function CreateForm() {
  const [values, setValues] = useState<EventFormValues>(EMPTY_FORM);
  const setField = <F extends keyof EventFormValues>(field: F, value: EventFormValues[F]) => setValues((v) => ({ ...v, [field]: value }));
  return (
    <>
      <EventFormFields form={{ values, errors: {}, setField } as unknown as Parameters<typeof EventFormFields>[0]['form']} mode="create" />
      <output data-testid="start-value">{values.startLocal}</output>
    </>
  );
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const page = { items: [STOP], nextCursor: null, asOf: STOP.asOf, scope: { tenantId: 'tenant-a' } };
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(page), { status: 200, headers: { 'Content-Type': 'application/json' } })));
  configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  actAs('Engineer');
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  actAs('SuperAdmin');
});

describe('Event Hub UX remediation (U1)', () => {
  it('labels an open stop "Ongoing" with the one duration format (A-4, C-3)', async () => {
    wrap(<CurrentStopsPanel unitIds={[]} onClose={() => undefined} />);
    await waitFor(() => expect(screen.getByTestId('current-stop-elapsed')).toHaveTextContent('Ongoing 2 d 11 h'));
  });

  it('titles the code dialog by kind and uses the kit checkbox (E-L4)', () => {
    const stop = wrap(<CodeEventDialog event={eventOf('downtime')} onClose={() => undefined} onDone={() => undefined} />);
    expect(screen.getByRole('heading', { name: 'Code stop' })).toBeInTheDocument();
    const box = screen.getByRole('checkbox', { name: /Investigation pending/ });
    fireEvent.click(box);
    expect(box).toHaveAttribute('data-state', 'checked');
    stop.unmount();
    wrap(<CodeEventDialog event={eventOf('quality_loss')} onClose={() => undefined} onDone={() => undefined} />);
    expect(screen.getByRole('heading', { name: 'Code event' })).toBeInTheDocument();
  });

  it('leaves the new event start empty until "Now" fills the plant time (E-L7)', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-18T06:00:30.000Z'));
    wrap(<CreateForm />);
    expect(screen.getByTestId('start-value')).toHaveTextContent('');
    fireEvent.click(screen.getByTestId('now-startLocal'));
    expect(screen.getByTestId('start-value')).toHaveTextContent('2026-10-18T09:30');
  });
});
