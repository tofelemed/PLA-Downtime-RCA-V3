import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { ProductionEventView } from '@/api/v2/types/events';
import { actAs } from '@/test/acting-user';
import { initialSplitRows, percentOf, reasonWeightsBody, splitComplete } from './model/reason-split';
import { EventHubEnvContext, type EventHubEnv } from './use-event-hub-env';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/features/ux-kit/labels/use-user-names', () => ({ useUserNames: () => ({ nameOf: () => 'A. Karimi', isLoading: false }) }));

const { CodeEventDialog } = await import('./components/code-event-dialog');
const { ReasonWeightsText } = await import('./components/reason-weights-text');

const NAMES: Record<string, string> = { r1: 'Motor trip', r2: 'Belt slip' };
const ENV: EventHubEnv = {
  tenantId: 'tenant-a', timezone: 'UTC', timezoneIsFallback: false, units: [], unitsLoading: false, reasonCodes: [], allReasonCodes: [],
  unitName: () => 'Extruder 1', reasonName: (id) => (id ? (NAMES[id] ?? '—') : '—'),
};

const STOP = {
  id: 'e1', unitId: 'u1', startTime: '2026-10-15T06:00:00.000Z', endTime: '2026-10-15T07:00:00.000Z', isOpen: false, durationSeconds: 3600,
  classification: { physicalType: 'downtime' }, states: { physical: 'closed', coding: 'coded', rca: 'none' }, rowVersion: 3,
  reasonCodeId: 'r1',
  reasonWeights: [
    { reasonCodeId: 'r1', weight: '0.60000000' },
    { reasonCodeId: 'r2', weight: '0.40000000' },
  ],
} as unknown as ProductionEventView;

let reply: { status: number; body: unknown } = { status: 200, body: STOP };
let sent: unknown[] = [];
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
  reply = { status: 200, body: STOP };
  sent = [];
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') sent.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'Content-Type': 'application/json', ETag: '"4"' } });
    }),
  );
  configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
});
afterEach(() => {
  vi.unstubAllGlobals();
  actAs('SuperAdmin');
});

const values = () => screen.getAllByTestId('split-value') as HTMLInputElement[];
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save reason' }));

describe('reason split model (D-T5)', () => {
  it('prefills a stored split as percents that add up to 100 again, or the current reason and an empty row', () => {
    expect(initialSplitRows(STOP).map((r) => [r.reasonCodeId, r.value])).toEqual([
      ['r1', '60'],
      ['r2', '40'],
    ]);
    expect(percentOf('0.33333334')).toBe('33.333334');
    expect(percentOf('0.33333334', 2)).toBe('33.33');
    expect(initialSplitRows({ reasonCodeId: 'r1', reasonWeights: null }).map((r) => r.reasonCodeId)).toEqual(['r1', '']);
  });

  it('sends percents as typed and minutes as seconds; the server checks the sum', () => {
    const rows = [
      { key: 0, reasonCodeId: 'r1', value: '45' },
      { key: 1, reasonCodeId: 'r2', value: '15' },
    ];
    expect(reasonWeightsBody(rows, 'percent')).toEqual([
      { reasonCodeId: 'r1', percent: '45' },
      { reasonCodeId: 'r2', percent: '15' },
    ]);
    expect(reasonWeightsBody(rows, 'minutes')).toEqual([
      { reasonCodeId: 'r1', seconds: 2700 },
      { reasonCodeId: 'r2', seconds: 900 },
    ]);
    expect(splitComplete(rows)).toBe(true);
    expect(splitComplete([rows[0]])).toBe(false);
    expect(splitComplete([rows[0], { ...rows[1], value: ' ' }])).toBe(false);
  });
});

describe('Code dialog: split across several reasons (D-T5)', () => {
  it('opens a stored split and saves the new percents', async () => {
    const onDone = vi.fn();
    wrap(<CodeEventDialog event={STOP} onClose={() => undefined} onDone={onDone} />);
    expect(screen.getByTestId('split-enabled')).toHaveAttribute('data-state', 'checked');
    expect(values().map((input) => input.value)).toEqual(['60', '40']);
    fireEvent.change(values()[0], { target: { value: '70' } });
    fireEvent.change(values()[1], { target: { value: '30' } });
    save();
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(sent).toEqual([
      {
        reasonWeights: [
          { reasonCodeId: 'r1', percent: '70' },
          { reasonCodeId: 'r2', percent: '30' },
        ],
      },
    ]);
  });

  it('sends minutes as seconds for an ended stop', async () => {
    wrap(<CodeEventDialog event={STOP} onClose={() => undefined} onDone={() => undefined} />);
    fireEvent.click(screen.getByRole('radio', { name: /Minutes/ }));
    fireEvent.change(values()[0], { target: { value: '45' } });
    fireEvent.change(values()[1], { target: { value: '15' } });
    save();
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({
      reasonWeights: [
        { reasonCodeId: 'r1', seconds: 2700 },
        { reasonCodeId: 'r2', seconds: 900 },
      ],
    });
  });

  it('shows the server’s reason when the split does not add up', async () => {
    const message = 'The percents add up to 90 %, not 100 %';
    reply = { status: 422, body: { code: 'REASON_WEIGHTS_SUM', message: [message], fieldErrors: [{ field: 'reasonWeights', message }] } };
    const onDone = vi.fn();
    wrap(<CodeEventDialog event={STOP} onClose={() => undefined} onDone={onDone} />);
    fireEvent.change(values()[1], { target: { value: '30' } });
    save();
    expect(await screen.findByTestId('command-error')).toHaveTextContent(message);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('removes a stored split when the section is switched off', async () => {
    wrap(<CodeEventDialog event={STOP} onClose={() => undefined} onDone={() => undefined} />);
    fireEvent.click(screen.getByTestId('split-enabled'));
    expect(screen.queryAllByTestId('split-row')).toHaveLength(0);
    save();
    await waitFor(() => expect(sent).toEqual([{ reasonWeights: null }]));
  });

  it('offers minutes only once the stop has ended', () => {
    const running = { ...STOP, endTime: null, isOpen: true, durationSeconds: null, reasonWeights: null };
    wrap(<CodeEventDialog event={running} onClose={() => undefined} onDone={() => undefined} />);
    fireEvent.click(screen.getByTestId('split-enabled'));
    expect(screen.getByRole('radio', { name: /Minutes/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save reason' })).toBeDisabled();
  });
});

describe('event detail: weights as stored', () => {
  it('lists each reason with its share, the primary first', () => {
    wrap(<ReasonWeightsText weights={STOP.reasonWeights ?? []} />);
    expect(screen.getByTestId('reason-weights')).toHaveTextContent('Motor trip 60 %Belt slip 40 %');
  });
});

describe('Code dialog: production loss split by tonnes (declared mode)', () => {
  const LOSS = {
    ...STOP,
    classification: { physicalType: 'production_loss' },
    quantity: '7.5',
    declaredFigures: { planned: 120, actual: 112.5, shortfall: 7.5, uom: 't', measurementQuality: null, sourceStatus: null, plan: null, piSource: null },
  } as unknown as ProductionEventView;

  it('offers Percent or Tonnes, never Minutes, and says what the tonnes must add up to', () => {
    wrap(<CodeEventDialog event={LOSS} onClose={() => undefined} onDone={() => undefined} />);
    expect(screen.queryByRole('radio', { name: /Minutes/ })).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Tonnes' }));
    expect(screen.getByText(/The tonnes must add up to the day's shortfall \(7\.5 t\)\./)).toBeInTheDocument();
  });

  it('shows the tonnes still to place, blocks a sum that is off and sends quantity entries when it fits', async () => {
    const onDone = vi.fn();
    wrap(<CodeEventDialog event={LOSS} onClose={() => undefined} onDone={onDone} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Tonnes' }));
    fireEvent.change(values()[0], { target: { value: '4' } });
    fireEvent.change(values()[1], { target: { value: '3' } });
    expect(screen.getByTestId('split-tonnes-remaining')).toHaveTextContent('0.5 t still to place.');
    expect(screen.getByRole('button', { name: 'Save reason' })).toBeDisabled();
    fireEvent.change(values()[1], { target: { value: '3.5' } });
    expect(screen.getByTestId('split-tonnes-remaining')).toHaveTextContent('add up to the shortfall');
    save();
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(sent).toEqual([{ reasonWeights: [{ reasonCodeId: 'r1', quantity: '4' }, { reasonCodeId: 'r2', quantity: '3.5' }] }]);
  });
});
