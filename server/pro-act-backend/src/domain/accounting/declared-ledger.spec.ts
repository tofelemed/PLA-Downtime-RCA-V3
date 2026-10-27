import { Dec, formatDec } from '../actuals/decimal';
import {
  LossEvent,
  PeriodAccountingInput,
  SliceInput,
} from './accounting.types';
import {
  chooseDeclaredEvent,
  computeDeclaredAccounting,
  DECLARED_SINGLE_SLICE,
} from './declared-ledger';
import {
  readStopsCrossCheck,
  shareQuantities,
  stopsCrossCheckFlag,
} from './declared-lines';
import { computePeriodAccounting } from './period-accounting';

const START = new Date('2027-03-03T02:30:00Z');
const END = new Date('2027-03-04T02:30:00Z');

function productionLoss(
  id: string,
  figures: { shortfall: number; uom?: string },
): LossEvent {
  return {
    eventId: id,
    revisionId: null,
    revision: null,
    occurrenceId: `occ-${id}`,
    physicalType: 'production_loss',
    start: START,
    end: END,
    scheduleClass: 'unplanned',
    oeeComponent: 'none',
    impactMode: 'measured',
    impactFraction: null,
    quantity: String(figures.shortfall),
    reasonCodeId: 'R1',
    impactCodeId: null,
    failureMode: null,
    declaredFigures: {
      planned: 1000,
      actual: 1000 - figures.shortfall,
      shortfall: figures.shortfall,
      uom: figures.uom ?? 't',
      measurementQuality: null,
      sourceStatus: 'CONFIRMED',
      plan: null,
      piSource: null,
    },
  };
}

function slice(id: string): SliceInput {
  return {
    sliceId: id,
    window: { start: START, end: END },
    uom: 't',
    sustainedRates: null,
    planningRates: [],
    target: '1000',
    actuals: { gross: '970', good: '968', uom: 't' },
    concurrent: false,
  };
}

function input(
  events: LossEvent[],
  overrides: Partial<PeriodAccountingInput> = {},
): PeriodAccountingInput {
  return {
    window: { start: START, end: END },
    periodExcluded: false,
    periodExclusionKind: null,
    schedule: [],
    events,
    slices: [slice('S1')],
    asOf: END,
    reasonComponents: { R1: 'availability' },
    policy: {
      microStopSeconds: 60,
      derateComponent: 'performance',
      plannedStopsInsideScheduleReduceAvailability: true,
      epsilon: '0.000001',
      lossBasis: 'declared',
      targetSource: 'declared',
      stopsCrossCheck: false,
      identityTolerance: 0,
    },
    ...overrides,
  };
}

describe('shareQuantities', () => {
  it('adds up to the shortfall exactly, the last share taking the remainder', () => {
    const parts = shareQuantities(new Dec('10'), [
      new Dec('0.33333333'),
      new Dec('0.33333333'),
      new Dec('0.33333334'),
    ]);
    expect(parts.map(formatDec)).toEqual([
      '3.3333333',
      '3.3333333',
      '3.3333334',
    ]);
    expect(formatDec(parts.reduce((a, b) => a.plus(b)))).toBe('10');
  });

  it('gives no parts without weights', () => {
    expect(shareQuantities(new Dec(5), [])).toEqual([]);
  });
});

describe('stops cross-check flag', () => {
  it('round-trips as { stops_cross_check: { quantity, uom } }', () => {
    const flag = stopsCrossCheckFlag(new Dec('150.5'), 't');
    expect(flag).toBe('stops_cross_check:150.5:t');
    expect(readStopsCrossCheck(['unaccounted', flag])).toEqual({
      stops_cross_check: { quantity: '150.5', uom: 't' },
    });
    expect(readStopsCrossCheck(['unaccounted'])).toBeNull();
  });
});

describe('chooseDeclaredEvent', () => {
  it('takes the lowest id of several events for the period window', () => {
    const chosen = chooseDeclaredEvent(
      input([
        productionLoss('b', { shortfall: 1 }),
        productionLoss('a', { shortfall: 2 }),
      ]),
    );
    expect(chosen.event?.eventId).toBe('a');
    expect(chosen.duplicate).toBe(true);
  });
});

describe('computeDeclaredAccounting', () => {
  it('uses the first slice only and flags declared_single_slice (D4)', () => {
    const result = computeDeclaredAccounting(
      input([productionLoss('a', { shortfall: 32 })], {
        slices: [slice('S1'), slice('S2')],
      }),
    );
    expect(result.totals.map((t) => t.sliceId)).toEqual(['S1']);
    expect(result.totals[0].flags).toContain(DECLARED_SINGLE_SLICE);
    expect(result.lines.every((l) => l.sliceId === 'S1')).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('never converts units: figures in another unit give no lines', () => {
    const result = computeDeclaredAccounting(
      input([productionLoss('a', { shortfall: 32, uom: 'kg' })]),
    );
    expect(result.lines).toEqual([]);
    expect(result.totals[0].flags).toContain('uom_mismatch');
    expect(result.totals[0].residual).toBeNull();
  });

  it('has no result without a slice', () => {
    const result = computeDeclaredAccounting(input([], { slices: [] }));
    expect(result).toEqual({
      lines: [],
      totals: [],
      issues: [],
      segmentCount: 0,
    });
  });

  it('a shortfall ≤ 0 is no loss line; the gap stays in the totals', () => {
    const result = computeDeclaredAccounting(
      input([productionLoss('a', { shortfall: 0 })]),
    );
    expect(result.lines.map((l) => l.kind)).toEqual(['residual']);
    expect(result.issues).toEqual([]);
  });
});

describe('computed mode', () => {
  it('a production loss event produces no line (2.8 behaviour)', () => {
    const declared = input([productionLoss('a', { shortfall: 32 })]);
    const computed = {
      ...declared,
      policy: { ...declared.policy, lossBasis: 'computed' as const },
    };
    const result = computePeriodAccounting(computed);
    expect(result.lines.some((l) => l.cause?.eventId === 'a')).toBe(false);
    expect(result.lines.some((l) => l.basis === 'declared')).toBe(false);
  });
});
