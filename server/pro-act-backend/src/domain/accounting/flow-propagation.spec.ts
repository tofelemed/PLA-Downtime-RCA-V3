import { Dec, formatDec } from '../actuals/decimal';
import {
  FlowInput,
  FlowRoute,
  LossEvent,
  LossLineDraft,
  PeriodAccountingInput,
} from './accounting.types';
import { computePeriodAccounting } from './period-accounting';

/**
 * SME E2 worked example: a reactor R feeds an extruder X through 100 usable tonnes of buffer; X draws
 * 20 t/h, so the buffer gives 5 h of cover. X runs at 20 t/h over a 12 h period (00:00–12:00).
 * - a 2 h reactor stop (01:00–03:00) costs X nothing;
 * - a 7 h reactor stop (04:00–11:00) starves X for 2 h (09:00–11:00): 40 t of X availability loss,
 *   charged to the reactor stop (origin unit R, schedule class external).
 */
const T0 = Date.parse('2027-05-01T00:00:00Z');
const at = (hours: number) => new Date(T0 + hours * 3_600_000);

function stop(id: string, from: number, to: number | null): LossEvent {
  return {
    eventId: id,
    revisionId: null,
    revision: null,
    occurrenceId: id,
    physicalType: 'downtime',
    start: at(from),
    end: to === null ? null : at(to),
    scheduleClass: 'unplanned',
    oeeComponent: 'availability',
    impactMode: 'full_stop',
    impactFraction: null,
    quantity: null,
    reasonCodeId: `reason-${id}`,
    impactCodeId: null,
    failureMode: null,
  };
}

const route = (
  from: string,
  to: string,
  extra: Partial<FlowRoute> = {},
): FlowRoute => ({
  fromUnitId: from,
  toUnitId: to,
  role: 'feed',
  usableInventory: '100',
  minLevel: null,
  drawRatePerHour: '20',
  from: at(-1000),
  to: null,
  ...extra,
});

function input(
  flow: Partial<FlowInput>,
  events: LossEvent[] = [],
): PeriodAccountingInput {
  const window = { start: at(0), end: at(12) };
  return {
    window,
    periodExcluded: false,
    periodExclusionKind: null,
    schedule: [],
    events,
    asOf: window.end,
    policy: {
      microStopSeconds: 60,
      derateComponent: 'performance',
      plannedStopsInsideScheduleReduceAvailability: true,
      epsilon: '0.000001',
    },
    slices: [
      {
        sliceId: 'X1',
        window,
        uom: 't',
        sustainedRates: [
          { id: 'sus', rate: '20', timebase: 'h', from: at(-1), to: null },
        ],
        planningRates: [
          { id: 'plan', rate: '20', timebase: 'h', from: at(-1), to: null },
        ],
        target: null,
        actuals: { gross: '200', good: '200', uom: 't' },
        concurrent: false,
      },
    ],
    flow: {
      unitId: 'X',
      routes: [route('R', 'X')],
      upstreamStops: [],
      levels: [],
      maxLevelAgeSeconds: 86_400,
      ...flow,
    },
  };
}

const starvation = (lines: readonly LossLineDraft[]) =>
  lines.filter(
    (l) => l.ledger === 'capacity' && l.flags.includes('upstream_starvation'),
  );
const sum = (lines: readonly LossLineDraft[]) =>
  formatDec(lines.reduce((s, l) => s.plus(l.quantity), new Dec(0)));

describe('plant flow and buffers (SME E2)', () => {
  it('a 2 h reactor stop is covered by the 5 h buffer: no extruder loss', () => {
    const result = computePeriodAccounting(
      input({ upstreamStops: [{ unitId: 'R', event: stop('R-2H', 1, 3) }] }),
    );
    expect(starvation(result.lines)).toEqual([]);
    expect(result.issues).toEqual([]);
  });

  it('a 7 h reactor stop starves the extruder for 2 h: 40 t charged to the reactor stop', () => {
    const lines = starvation(
      computePeriodAccounting(
        input({ upstreamStops: [{ unitId: 'R', event: stop('R-7H', 4, 11) }] }),
      ).lines,
    );
    expect(sum(lines)).toBe('40');
    expect(lines[0]).toMatchObject({
      kind: 'availability',
      segmentStart: at(9),
      segmentEnd: at(11),
      scheduleClass: 'external',
    });
    expect(lines[0].cause?.eventId).toBe('R-7H');
    expect(lines[0].cause?.reasonCodeId).toBe('reason-R-7H');
    expect(lines[0].flags).toEqual(['upstream_starvation', 'origin_unit:R']);
  });

  it('uses a recorded buffer level where available: 60 t above a 20 t minimum = 2 h cover → 5 h, 100 t', () => {
    const lines = starvation(
      computePeriodAccounting(
        input({
          routes: [route('R', 'X', { minLevel: '20' })],
          levels: [
            { fromUnitId: 'R', toUnitId: 'X', at: at(3.5), level: '60' },
          ],
          upstreamStops: [{ unitId: 'R', event: stop('R-7H', 4, 11) }],
        }),
      ).lines,
    );
    expect(sum(lines)).toBe('100');
  });

  it("keeps the extruder's own recorded stop as the fact: derived time only outside it", () => {
    const result = computePeriodAccounting(
      input({ upstreamStops: [{ unitId: 'R', event: stop('R-7H', 4, 11) }] }, [
        stop('X-OWN', 9, 10),
      ]),
    );
    expect(sum(starvation(result.lines))).toBe('20');
    const own = result.lines.filter(
      (l) => l.ledger === 'capacity' && l.cause?.eventId === 'X-OWN',
    );
    expect(sum(own)).toBe('20');
  });

  it('propagates through a chain to the originating stop (feed Q → R direct, R → X 5 h buffer)', () => {
    const lines = starvation(
      computePeriodAccounting(
        input({
          routes: [
            route('Q', 'R', { usableInventory: null, drawRatePerHour: null }),
            route('R', 'X'),
          ],
          upstreamStops: [{ unitId: 'Q', event: stop('Q-8H', 2, 10) }],
        }),
      ).lines,
    );
    // R starves 02:00–10:00 at once (no buffer); X after 5 h of cover: 07:00–10:00 = 60 t, charged to Q
    expect(sum(lines)).toBe('60');
    expect(lines.every((l) => l.cause?.eventId === 'Q-8H')).toBe(true);
    expect(lines[0].flags).toContain('origin_unit:Q');
  });

  it('an alternate route that keeps running prevents starvation; when it stops too, the extruder starves', () => {
    const routes = [
      route('R', 'X'),
      route('S', 'X', {
        role: 'alternate',
        usableInventory: null,
        drawRatePerHour: null,
      }),
    ];
    const reactorOnly = computePeriodAccounting(
      input({
        routes,
        upstreamStops: [{ unitId: 'R', event: stop('R-7H', 4, 11) }],
      }),
    );
    expect(starvation(reactorOnly.lines)).toEqual([]);
    const both = computePeriodAccounting(
      input({
        routes,
        upstreamStops: [
          { unitId: 'R', event: stop('R-7H', 4, 11) },
          { unitId: 'S', event: stop('S-1H', 9.5, 10.5) },
        ],
      }),
    );
    expect(sum(starvation(both.lines))).toBe('20');
  });

  it('changes nothing without a flow map', () => {
    const plain = computePeriodAccounting({ ...input({}), flow: null });
    const empty = computePeriodAccounting(input({ routes: [] }));
    expect(starvation(plain.lines)).toEqual([]);
    expect(plain.lines.length).toBe(empty.lines.length);
  });
});
