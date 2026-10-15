import * as fc from 'fast-check';
import { Dec, formatDec } from '../../src/domain/actuals/decimal';
import {
  LossEvent,
  OverlapAllocation,
  PeriodAccountingInput,
} from '../../src/domain/accounting/accounting.types';
import { allocateCauses } from '../../src/domain/accounting/cause-allocator';
import { segmentSlice } from '../../src/domain/accounting/segmentation';
import { allocateDowntime } from '../../src/domain/kpi/downtime-allocation';

/**
 * Plan 1.10 step 4 `CauseAllocator` (DT07, SME D7 / Q11): one allocation of overlapping stops for the loss
 * ledgers (2.5 segmentation) and the KPI downtime breakdowns (2.7). The refactor changes no result: for
 * random overlapping stops, every cause gets the same seconds from the ledger segments and from the KPI
 * allocation under both rules; arrival order never matters; the D7 worked example and the plan's overlap
 * fixture hold.
 */
const T0 = Date.parse('2027-03-01T06:30:00Z');
const at = (minutes: number) => new Date(T0 + minutes * 60_000);
const WINDOW = { start: at(0), end: at(480) };

function stop(id: string, from: number, to: number): LossEvent {
  return {
    eventId: id,
    revisionId: null,
    revision: null,
    occurrenceId: `occ-${id}`,
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
  };
}

function input(
  events: LossEvent[],
  rule: OverlapAllocation,
): PeriodAccountingInput {
  return {
    window: WINDOW,
    periodExcluded: false,
    periodExclusionKind: null,
    schedule: [],
    events,
    asOf: WINDOW.end,
    policy: {
      overlapAllocation: rule,
      microStopSeconds: 60,
      derateComponent: 'performance',
      plannedStopsInsideScheduleReduceAvailability: true,
      epsilon: '0.000001',
    },
    slices: [
      {
        sliceId: 'S1',
        window: WINDOW,
        uom: 't',
        sustainedRates: [
          { id: 'sus', rate: '100', timebase: 'h', from: at(-1), to: null },
        ],
        planningRates: [],
        target: null,
        actuals: null,
        concurrent: false,
      },
    ],
  };
}

/** Seconds per cause event from the ledger's atomic segments (Σ segment seconds × share). */
function ledgerSeconds(events: LossEvent[], rule: OverlapAllocation) {
  const i = input(events, rule);
  const totals = new Map<string, Dec>();
  for (const segment of segmentSlice(i, i.slices[0])) {
    for (const cause of segment.stops) {
      const id = cause.event.eventId;
      const seconds = segment.seconds.mul(cause.share);
      totals.set(id, (totals.get(id) ?? new Dec(0)).plus(seconds));
    }
  }
  return toRecord(totals);
}

function kpiSeconds(events: LossEvent[], rule: OverlapAllocation) {
  const totals = new Map<string, Dec>();
  for (const c of allocateDowntime(events, WINDOW, WINDOW.end, rule)) {
    const id = c.event.eventId;
    totals.set(id, (totals.get(id) ?? new Dec(0)).plus(c.seconds));
  }
  return toRecord(totals);
}

const toRecord = (totals: Map<string, Dec>) =>
  Object.fromEntries(
    [...totals.entries()]
      .filter(([, s]) => !s.isZero())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, s]) => [id, formatDec(s)]),
  );

/** Random stops of 2–120 min inside the 8 h window, some overlapping (none micro). */
const stopsArb = fc
  .array(
    fc.tuple(
      fc.integer({ min: 0, max: 470 }),
      fc.integer({ min: 2, max: 120 }),
    ),
    { minLength: 1, maxLength: 6 },
  )
  .map((pairs) =>
    pairs.map(([from, length], i) =>
      stop(`e${i}`, from, Math.min(480, from + length)),
    ),
  );

describe('plan 1.10 CauseAllocator: one overlap allocation for ledgers and KPIs', () => {
  it.each<OverlapAllocation>(['first_out', 'equal_share'])(
    'ledger segments and KPI breakdowns give every cause the same seconds (%s, property)',
    (rule) => {
      fc.assert(
        fc.property(stopsArb, (events) => {
          expect(ledgerSeconds(events, rule)).toEqual(kpiSeconds(events, rule));
        }),
        { numRuns: 200 },
      );
    },
  );

  it('arrival order never changes the allocation (property)', () => {
    fc.assert(
      fc.property(
        stopsArb.chain((events) =>
          fc.tuple(
            fc.constant(events),
            fc.shuffledSubarray(events, {
              minLength: events.length,
              maxLength: events.length,
            }),
          ),
        ),
        ([events, shuffled]) => {
          for (const rule of ['first_out', 'equal_share'] as const) {
            expect(allocateCauses(shuffled, rule)).toEqual(
              allocateCauses(events, rule),
            );
            expect(kpiSeconds(shuffled, rule)).toEqual(
              kpiSeconds(events, rule),
            );
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('SME D7 example: motor 10:00–10:30, chute 10:05–10:45 → 30 min motor, 15 min chute (first-out)', () => {
    const events = [stop('motor', 210, 240), stop('chute', 215, 255)];
    expect(kpiSeconds(events, 'first_out')).toEqual({
      chute: '900',
      motor: '1800',
    });
    expect(ledgerSeconds(events, 'first_out')).toEqual({
      chute: '900',
      motor: '1800',
    });
  });

  it('plan fixture: stops 10–11 and 10:30–11:30 → 90 min in all, shares of every segment sum to 1', () => {
    const events = [stop('a', 210, 270), stop('b', 240, 300)];
    const i = input(events, 'equal_share');
    const segments = segmentSlice(i, i.slices[0]).filter(
      (s) => s.stops.length > 0,
    );
    for (const s of segments) {
      expect(
        formatDec(s.stops.reduce((sum, c) => sum.plus(c.share), new Dec(0))),
      ).toBe('1');
    }
    const total = Object.values(kpiSeconds(events, 'equal_share')).reduce(
      (sum, s) => sum.plus(s),
      new Dec(0),
    );
    expect(formatDec(total)).toBe('5400');
    expect(kpiSeconds(events, 'equal_share')).toEqual({
      a: '2700',
      b: '2700',
    });
  });
});
