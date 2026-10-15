import { Dec, formatDec } from '../actuals/decimal';
import {
  LedgerTotals,
  LossEvent,
  LossLineDraft,
  PeriodAccountingInput,
  SliceInput,
  StreamRun,
} from './accounting.types';
import { computePeriodAccounting } from './period-accounting';

/**
 * SME E6 / LA-10 fixtures: concurrent products on parallel streams. Unit rate 50 t/h over an 8 h period
 * (00:00–08:00); train T1 gives 60 % of it (30 t/h) and runs product A, train T2 40 % (20 t/h) and runs
 * product B. Each product slice spans the whole window.
 *
 * - T2 trips 01:00–03:00 (stream event) · the unit stops 05:00–06:00 (both trains) · a unit-wide quality
 *   event declares 10 t over 06:00–08:00.
 * - A: capacity 0.6 × 50 × 8 = 240 · availability 1 h × 30 = 30 · gross 200 → performance 10 · quality
 *   6 (60 % of the 10 t) · good 194 · residual 0.
 * - B: capacity 0.4 × 50 × 8 = 160 · availability 2 h × 20 + 1 h × 20 = 60 · gross 90 → performance 10
 *   · quality 4 · good 86 · residual 0.
 * - Σ capacity 400 = the unit's 50 × 8 (no double count); Σ quality claims 10 = the event (mass once).
 */
const T0 = Date.parse('2027-04-01T00:00:00Z');
const at = (hours: number) => new Date(T0 + hours * 3_600_000);
const WINDOW = { start: at(0), end: at(8) };

function event(
  id: string,
  from: number,
  to: number,
  extra: Partial<LossEvent> = {},
): LossEvent {
  return {
    eventId: id,
    revisionId: null,
    revision: null,
    occurrenceId: id,
    physicalType: 'downtime',
    start: at(from),
    end: at(to),
    scheduleClass: 'unplanned',
    oeeComponent: 'availability',
    impactMode: 'full_stop',
    impactFraction: null,
    quantity: null,
    reasonCodeId: null,
    impactCodeId: null,
    failureMode: null,
    ...extra,
  };
}

function slice(
  id: string,
  productId: string,
  actuals: { gross: string; good: string },
  concurrent = true,
): SliceInput {
  return {
    sliceId: id,
    productId,
    window: WINDOW,
    uom: 't',
    sustainedRates: [
      { id: 'sus', rate: '50', timebase: 'h', from: at(-1), to: null },
    ],
    planningRates: [
      { id: 'plan', rate: '50', timebase: 'h', from: at(-1), to: null },
    ],
    target: null,
    actuals: { ...actuals, uom: 't' },
    concurrent,
  };
}

const run = (
  streamId: string,
  productId: string,
  share: string,
  from: number,
  to: number | null,
): StreamRun => ({
  streamId,
  productId,
  share,
  start: at(from),
  end: to === null ? null : at(to),
});

function input(
  extra: Partial<PeriodAccountingInput> = {},
): PeriodAccountingInput {
  return {
    window: WINDOW,
    periodExcluded: false,
    periodExclusionKind: null,
    schedule: [],
    events: [
      event('T2-TRIP', 1, 3, { streamId: 'T2' }),
      event('UNIT-STOP', 5, 6),
      event('QUALITY', 6, 8, {
        physicalType: 'quality_loss',
        oeeComponent: 'quality',
        impactMode: 'measured',
        quantity: '10',
      }),
    ],
    asOf: WINDOW.end,
    policy: {
      microStopSeconds: 60,
      derateComponent: 'performance',
      plannedStopsInsideScheduleReduceAvailability: true,
      epsilon: '0.000001',
    },
    slices: [
      slice('A', 'PA', { gross: '200', good: '194' }),
      slice('B', 'PB', { gross: '90', good: '86' }),
    ],
    streamRuns: [
      run('T1', 'PA', '0.6', -2, null),
      run('T2', 'PB', '0.4', -2, null),
    ],
    ...extra,
  };
}

const capacityTotals = (totals: readonly LedgerTotals[], sliceId: string) =>
  totals.find((t) => t.ledger === 'capacity' && t.sliceId === sliceId)!;
const text = (value: Dec | null) => (value === null ? null : formatDec(value));
const sum = (lines: readonly LossLineDraft[]) =>
  formatDec(lines.reduce((s, l) => s.plus(l.quantity), new Dec(0)));

describe('concurrent products on parallel streams (SME E6 / LA-10)', () => {
  it('gives each product the capacity of the stream time it ran: 240 t and 160 t, Σ 400 t', () => {
    const result = computePeriodAccounting(input());
    expect(result.issues).toEqual([]);
    const a = capacityTotals(result.totals, 'A');
    const b = capacityTotals(result.totals, 'B');
    expect(
      [a.capacity, a.availability, a.performance, a.quality, a.residual].map(
        text,
      ),
    ).toEqual(['240', '30', '10', '6', '0']);
    expect(
      [b.capacity, b.availability, b.performance, b.quality, b.residual].map(
        text,
      ),
    ).toEqual(['160', '60', '10', '4', '0']);
    expect(formatDec(a.capacity!.plus(b.capacity!))).toBe('400');
    expect(a.flags).toContain('stream_capacity');
    expect(a.flags).not.toContain('concurrent_products');
  });

  it("charges a train's trip only to the product that train ran", () => {
    const lines = computePeriodAccounting(input()).lines.filter(
      (l) => l.ledger === 'capacity' && l.cause?.eventId === 'T2-TRIP',
    );
    expect(lines.map((l) => l.sliceId)).toEqual(['B']);
    expect(sum(lines)).toBe('40');
  });

  it('assigns a unit-wide declared quantity once, split by stream capacity (6 t + 4 t = 10 t)', () => {
    const quality = computePeriodAccounting(input()).lines.filter(
      (l) => l.ledger === 'capacity' && l.cause?.eventId === 'QUALITY',
    );
    expect(sum(quality.filter((l) => l.sliceId === 'A'))).toBe('6');
    expect(sum(quality.filter((l) => l.sliceId === 'B'))).toBe('4');
  });

  it('keeps the 2.5 behaviour without streams: each concurrent slice uses the whole window (flagged)', () => {
    const result = computePeriodAccounting(input({ streamRuns: [] }));
    const a = capacityTotals(result.totals, 'A');
    expect(text(a.capacity)).toBe('400');
    expect(a.flags).toContain('concurrent_products');
  });

  it('a product switch on a stream moves the capacity with it; a product no stream ran has none', () => {
    const result = computePeriodAccounting(
      input({
        events: [],
        streamRuns: [
          run('T1', 'PA', '0.6', -2, 4),
          run('T1', 'PB', '0.6', 4, null),
          run('T2', 'PB', '0.4', -2, null),
        ],
        slices: [
          slice('A', 'PA', { gross: '100', good: '100' }),
          slice('B', 'PB', { gross: '200', good: '200' }),
          slice('C', 'PC', { gross: '0', good: '0' }),
        ],
      }),
    );
    // A: 4 h × 30 = 120 · B: 4 h × 30 + 8 h × 20 = 280 · C: none · Σ 400
    expect(text(capacityTotals(result.totals, 'A').capacity)).toBe('120');
    expect(text(capacityTotals(result.totals, 'B').capacity)).toBe('280');
    const c = capacityTotals(result.totals, 'C');
    expect(text(c.capacity)).toBe('0');
    expect(c.flags).toContain('no_stream_run');
  });

  it('one stream with share 1 reproduces the single-unit lines exactly (sequential units unchanged)', () => {
    const sequential = {
      events: [event('STOP', 2, 3)],
      slices: [
        {
          ...slice('A', 'PA', { gross: '300', good: '290' }, false),
          window: { start: at(0), end: at(8) },
        },
      ],
    };
    const plain = computePeriodAccounting(
      input({ ...sequential, streamRuns: [] }),
    );
    const streamed = computePeriodAccounting(
      input({ ...sequential, streamRuns: [run('R', 'PA', '1', -2, null)] }),
    );
    const view = (lines: readonly LossLineDraft[]) =>
      lines.map((l) => [
        l.ledger,
        l.kind,
        formatDec(l.quantity),
        l.cause?.eventId ?? null,
      ]);
    expect(view(streamed.lines)).toEqual(view(plain.lines));
  });
});
