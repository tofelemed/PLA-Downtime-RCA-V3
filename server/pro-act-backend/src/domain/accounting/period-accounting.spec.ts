import * as fc from 'fast-check';
import { Dec, formatDec } from '../actuals/decimal';
import {
  LossEvent,
  LossLineDraft,
  PeriodAccountingInput,
  SliceInput,
} from './accounting.types';
import { computePeriodAccounting } from './period-accounting';
import { equalShares } from './shares';

const T0 = Date.parse('2027-03-01T02:30:00Z');
const at = (minutes: number) => new Date(T0 + minutes * 60_000);
const sum = (lines: readonly LossLineDraft[]) =>
  formatDec(lines.reduce((s, l) => s.plus(l.quantity), new Dec(0)));

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

function input(
  events: LossEvent[],
  slice: Partial<SliceInput> = {},
): PeriodAccountingInput {
  const window = { start: at(0), end: at(480) };
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
        sliceId: 'S1',
        window,
        uom: 't',
        sustainedRates: [
          { id: 'sus', rate: '100', timebase: 'h', from: at(-1), to: null },
        ],
        planningRates: [
          { id: 'plan', rate: '90', timebase: 'h', from: at(-1), to: null },
        ],
        target: '700',
        actuals: { gross: '500', good: '480', uom: 't' },
        concurrent: false,
        ...slice,
      },
    ],
  };
}

const lines = (i: PeriodAccountingInput, ledger: string, kind: string) =>
  computePeriodAccounting(i).lines.filter(
    (l) => l.ledger === ledger && l.kind === kind,
  );

/** Random stops inside the 8 h window (minutes), some overlapping, none micro. */
const stopsArb = fc.array(
  fc.tuple(fc.integer({ min: 0, max: 470 }), fc.integer({ min: 2, max: 120 })),
  { minLength: 1, maxLength: 6 },
);
const toEvents = (stops: Array<[number, number]>) =>
  stops.map(([from, length], i) =>
    event(`E${i}`, from, Math.min(480, from + length)),
  );

describe('equalShares', () => {
  it('adds up to exactly 1 at 8 places', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 50 }), (n) => {
        const shares = equalShares(n);
        expect(shares.reduce((s, x) => s.plus(x), new Dec(0)).eq(1)).toBe(true);
        expect(shares.every((s) => s.decimalPlaces() <= 8)).toBe(true);
      }),
    );
  });
});

describe('computePeriodAccounting (plan 2.5)', () => {
  it('is deterministic: same inputs (in any order) → same keys and quantities', () => {
    fc.assert(
      fc.property(stopsArb, (stops) => {
        const events = toEvents(stops);
        const a = computePeriodAccounting(input(events));
        const b = computePeriodAccounting(input([...events].reverse()));
        const view = (r: typeof a) =>
          r.lines.map((l) => [
            l.autoKey,
            formatDec(l.quantity),
            l.rateVersionId,
          ]);
        expect(view(b)).toEqual(view(a));
      }),
    );
  });

  it('conserves capacity and shares for random overlapping stops (no issues, residual 0)', () => {
    fc.assert(
      fc.property(stopsArb, (stops) => {
        const result = computePeriodAccounting(
          input(toEvents(stops), {
            actuals: { gross: '100', good: '90', uom: 't' },
          }),
        );
        expect(result.issues).toEqual([]);
        const capacity = result.totals.find((t) => t.ledger === 'capacity')!;
        expect(capacity.residual!.abs().lte('0.000001')).toBe(true);
      }),
    );
  });

  it('T37: splitting a stop into two children of one occurrence leaves Σ allocated unchanged', () => {
    fc.assert(
      fc.property(
        stopsArb,
        fc.double({ min: 0.05, max: 0.95, noNaN: true }),
        (stops, at01) => {
          const events = toEvents(stops);
          const parent = events[0];
          const cut = Math.round(
            stops[0][0] +
              (Math.min(480, stops[0][0] + stops[0][1]) - stops[0][0]) * at01,
          );
          if (cut <= stops[0][0] || at(cut) >= parent.end!) return;
          const children = [
            { ...parent, eventId: 'C1', end: at(cut) },
            { ...parent, eventId: 'C2', start: at(cut) },
          ];
          const before = lines(input(events), 'capacity', 'availability');
          const after = lines(
            input([...children, ...events.slice(1)]),
            'capacity',
            'availability',
          );
          expect(sum(after)).toBe(sum(before));
        },
      ),
    );
  });

  it('a micro-stop (< 60 s) is a performance claim, not availability', () => {
    const i = input([event('M', 60, 60.5)], {
      actuals: { gross: '700', good: '700', uom: 't' },
    });
    expect(lines(i, 'capacity', 'availability')).toEqual([]);
    const perf = lines(i, 'capacity', 'performance');
    expect(
      perf.find((l) => l.cause?.eventId === 'M')!.quantity.toFixed(8),
    ).toBe('0.83333333');
  });

  it('a derate claims capacity × fraction inside performance, the rest has no cause', () => {
    const derate = event('D', 0, 60, {
      physicalType: 'slowdown',
      impactMode: 'fractional',
      impactFraction: '0.5',
    });
    const perf = lines(
      input([derate], { actuals: { gross: '700', good: '700', uom: 't' } }),
      'capacity',
      'performance',
    );
    expect(
      perf.map((l) => [l.cause?.eventId ?? null, formatDec(l.quantity)]),
    ).toEqual([
      ['D', '50'],
      [null, '50'],
    ]);
  });

  it('claims beyond the computed component fail validation (IMPOSSIBLE_CLAIM)', () => {
    const derate = event('D', 0, 480, {
      physicalType: 'slowdown',
      impactMode: 'fractional',
      impactFraction: '0.5',
    });
    const result = computePeriodAccounting(
      input([derate], { actuals: { gross: '700', good: '700', uom: 't' } }),
    );
    expect(result.issues.map((i) => i.code)).toContain('IMPOSSIBLE_CLAIM');
  });

  it('quality above gross or below zero fails validation', () => {
    const negativeGood = computePeriodAccounting(
      input([], { actuals: { gross: '10', good: '-5', uom: 't' } }),
    );
    expect(negativeGood.issues.map((i) => i.code)).toContain(
      'QUALITY_EXCEEDS_GROSS',
    );
    const goodAboveGross = computePeriodAccounting(
      input([], { actuals: { gross: '10', good: '20', uom: 't' } }),
    );
    expect(goodAboveGross.issues.map((i) => i.code)).toContain('NEGATIVE_LOSS');
  });

  it('never clamps the residual: only good known → residual = running capacity − good, signed', () => {
    const result = computePeriodAccounting(
      input([], { actuals: { gross: null, good: '900', uom: 't' } }),
    );
    const capacity = result.totals.find((t) => t.ledger === 'capacity')!;
    expect(formatDec(capacity.residual!)).toBe('-100');
    expect(capacity.flags).toContain('gross_unknown');
    expect(capacity.performance).toBeNull();
  });

  it('ACC04: no time-phased planning rate → no automatic plan lines, residual = gap', () => {
    const result = computePeriodAccounting(
      input([event('E', 0, 60)], { planningRates: [] }),
    );
    const plan = result.totals.find((t) => t.ledger === 'plan')!;
    expect(plan.flags).toContain('plan_allocation_required');
    expect(formatDec(plan.residual!)).toBe(formatDec(plan.gap!));
    expect(
      result.lines.filter((l) => l.ledger === 'plan').map((l) => l.kind),
    ).toEqual(['residual']);
  });

  it('missing actuals leave the residual unknown (null), never zero', () => {
    const result = computePeriodAccounting(input([], { actuals: null }));
    for (const totals of result.totals) {
      expect(totals.residual).toBeNull();
      expect(totals.flags).toContain('actuals_missing');
    }
  });

  it('no profile → no capacity lines and the ledger is flagged', () => {
    const result = computePeriodAccounting(input([], { sustainedRates: null }));
    expect(result.totals.find((t) => t.ledger === 'capacity')!.flags).toEqual([
      'no_profile',
    ]);
    expect(result.lines.filter((l) => l.ledger === 'capacity')).toEqual([]);
  });

  it('above-reference output is a gain line, not a negative performance loss', () => {
    const result = computePeriodAccounting(
      input([], { actuals: { gross: '850', good: '850', uom: 't' } }),
    );
    const gain = result.lines.find((l) => l.kind === 'gain')!;
    expect(formatDec(gain.quantity)).toBe('50');
    expect(gain.flags).toContain('above_reference');
    expect(result.issues).toEqual([]);
  });

  it('an excluded period is schedule exclusion only', () => {
    const i = {
      ...input([event('E', 0, 60)]),
      periodExcluded: true,
      periodExclusionKind: 'turnaround',
    };
    const capacity = computePeriodAccounting(i).totals.find(
      (t) => t.ledger === 'capacity',
    )!;
    expect(formatDec(capacity.exclusion!)).toBe('800');
    expect(formatDec(capacity.availability!)).toBe('0');
  });
});
