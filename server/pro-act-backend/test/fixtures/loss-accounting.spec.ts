import * as fs from 'fs';
import * as path from 'path';
import {
  LedgerTotals,
  LossEvent,
  PeriodAccountingInput,
  RateVersion,
  SliceInput,
} from '../../src/domain/accounting/accounting.types';
import { computePeriodAccounting } from '../../src/domain/accounting/period-accounting';
import { planTotals } from '../../src/domain/accounting/plan-totals';
import { Dec, formatDec } from '../../src/domain/actuals/decimal';

/**
 * Spec §19.1 T15–T17, T28, T30 and T03 (allocation) through the plan 2.5 accounting engine: the plan
 * identity with signed residuals, the two ledgers of T28, a rate change during a stop (T30) and shares
 * of overlapping stops (T03). Persisted versions run in `accounting-runs.int-spec.ts`.
 */
type Json = Record<string, unknown>;
const fixture = (id: string) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, `${id}.json`), 'utf8')) as {
    inputs: Json;
    expected: Json;
  };

const EPSILON = '0.000001';
const T0 = Date.parse('2027-03-03T02:30:00Z');
const at = (hours: number) => new Date(T0 + hours * 3_600_000);
const dec = (value: Dec | null) => (value === null ? null : formatDec(value));

function rate(
  id: string,
  perHour: string,
  from: Date,
  to: Date | null = null,
): RateVersion {
  return { id, rate: perHour, timebase: 'h', from, to };
}

function stop(
  id: string,
  from: Date,
  to: Date,
  assetOccurrence = id,
): LossEvent {
  return {
    eventId: id,
    revisionId: `rev-${id}`,
    revision: 1,
    occurrenceId: assetOccurrence,
    physicalType: 'downtime',
    start: from,
    end: to,
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
  slice: Partial<SliceInput>,
  extra: Partial<PeriodAccountingInput>,
): PeriodAccountingInput {
  const window = { start: at(0), end: at(8) };
  return {
    window,
    periodExcluded: false,
    periodExclusionKind: null,
    schedule: [],
    events: [],
    asOf: window.end,
    policy: {
      microStopSeconds: 60,
      derateComponent: 'performance',
      plannedStopsInsideScheduleReduceAvailability: true,
      epsilon: EPSILON,
    },
    ...extra,
    slices: [
      {
        sliceId: 'S1',
        window,
        uom: 't',
        sustainedRates: [rate('sus', '100', at(-100))],
        planningRates: [rate('plan', '90', at(-100))],
        target: null,
        actuals: null,
        concurrent: false,
        ...slice,
      },
    ],
  };
}

const totalsOf = (all: LedgerTotals[], ledger: string) =>
  all.find((t) => t.ledger === ledger)!;

describe('T15–T17 plan identity (plan 2.5)', () => {
  const run = (id: string) => {
    const { inputs } = fixture(id);
    const lines = (inputs.acceptedLines as string[]).map((q) => new Dec(q));
    return planTotals({
      target: new Dec(inputs.targetQty as string),
      actual: new Dec(inputs.actualQty as string),
      attributed: lines.reduce((s, q) => s.plus(q), new Dec(0)),
      epsilon: new Dec(EPSILON),
    });
  };

  it('T15: gap 150, attributed 140, residual 10 (unaccounted, signed)', () => {
    const totals = run('T15');
    const { expected } = fixture('T15');
    expect(dec(totals.gap)).toBe(expected.gap);
    expect(dec(totals.attributed)).toBe(expected.attributed);
    expect(dec(totals.residual)).toBe(expected.residual);
    expect(totals.flags).toContain(expected.residualLabel);
  });

  it('T16: over-accounting keeps the negative residual (−10) and flags 10 over-accounted', () => {
    const totals = run('T16');
    const { expected } = fixture('T16');
    expect(dec(totals.residual)).toBe(expected.residual);
    expect(dec(totals.overAccounted)).toBe(expected.overAccounted);
    expect(totals.flags).toContain('over_accounted');
  });

  it('T17: overproduction 50, residual −70, conflict; the negative residual is no loss', () => {
    const totals = run('T17');
    const { expected } = fixture('T17');
    expect(dec(totals.gap)).toBe(expected.gap);
    expect(dec(totals.overproduction)).toBe(expected.overproduction);
    expect(dec(totals.residual)).toBe(expected.residual);
    expect(totals.flags).toContain('conflict');
    expect(totals.flags).not.toContain('over_accounted');
    expect(dec(totals.overAccounted)).toBe('0');
  });
});

describe('T28 capacity ledger versus plan ledger', () => {
  const { inputs, expected } = fixture('T28');
  const result = computePeriodAccounting(
    input(
      {
        target: inputs.planTargetQty as string,
        actuals: {
          gross: inputs.grossQty as string,
          good: inputs.goodQty as string,
          uom: 't',
        },
      },
      {
        schedule: [
          {
            start: at(0),
            end: at(1),
            excluded: true,
            exclusionKind: 'planned_shutdown',
          },
        ],
        events: [stop('E1', at(3), at(4))],
      },
    ),
  );
  const capacity = totalsOf(result.totals, 'capacity');
  const plan = totalsOf(result.totals, 'plan');
  const want = expected.capacity as Json;

  it('capacity 800 = exclusion 100 + A 100 + P 30 + Q 20 + good 550, residual 0', () => {
    expect(result.issues).toEqual([]);
    expect(dec(capacity.capacity)).toBe(want.capacityQty);
    expect(dec(capacity.exclusion)).toBe(want.scheduleExclusion);
    expect(dec(capacity.availability)).toBe(want.availabilityLoss);
    expect(dec(capacity.performance)).toBe(want.performanceLoss);
    expect(dec(capacity.quality)).toBe(want.qualityLoss);
    expect(dec(capacity.good)).toBe(want.goodQty);
    expect(dec(capacity.residual)).toBe(want.residual);
  });

  it('plan gap 80 = stop 90 at the planned rate + quality 20 − recovery gain 30 (SME Q1 / Q2)', () => {
    const planWant = expected.plan as Json;
    expect(dec(plan.gap)).toBe(planWant.gap);
    const planLine = (kind: string) =>
      result.lines.find((l) => l.ledger === 'plan' && l.kind === kind);
    expect(dec(planLine('availability')!.quantity)).toBe(
      planWant.plannedRateStopCandidate,
    );
    expect(planLine('availability')!.basis).toBe('planning_rate');
    expect(dec(planLine('gain')!.quantity)).toBe(planWant.recoveryGain);
    expect(dec(planLine('quality')!.quantity)).toBe(planWant.qualityCandidate);
    expect(dec(plan.residual)).toBe(planWant.residual);
    expect(plan.flags).not.toContain('bridge_required');
    expect(plan.flags).not.toContain('over_accounted');
  });
});

describe('T30 rate version change during a stop', () => {
  const { expected } = fixture('T30');
  const result = computePeriodAccounting(
    input(
      {
        sustainedRates: [
          rate('v1', '100', at(-100), at(4)),
          rate('v2', '120', at(4)),
        ],
      },
      { events: [stop('E1', at(3.5), at(4.5))] },
    ),
  );
  const lines = result.lines.filter(
    (l) => l.ledger === 'capacity' && l.kind === 'availability',
  );

  it('110 t across two lines, one per rate version', () => {
    expect(lines).toHaveLength(expected.lines as number);
    expect(lines.map((l) => l.rateVersionId)).toEqual(
      expected.rateVersionsUsed,
    );
    expect(dec(lines.reduce((s, l) => s.plus(l.quantity), new Dec(0)))).toBe(
      expected.capacityLossQty,
    );
  });
});

describe('T03 overlapping asset stops: allocation', () => {
  const { inputs, expected } = fixture('T03');
  const events = (
    inputs.events as Array<{ id: string; start: string; end: string }>
  ).map((e) => stop(e.id, new Date(e.start), new Date(e.end)));
  const result = computePeriodAccounting(
    input(
      {
        window: {
          start: new Date('2026-10-07T08:00:00Z'),
          end: new Date('2026-10-07T16:00:00Z'),
        },
        sustainedRates: [rate('sus', '3600', new Date(0))],
      },
      {
        window: {
          start: new Date('2026-10-07T08:00:00Z'),
          end: new Date('2026-10-07T16:00:00Z'),
        },
        events,
      },
    ),
  );
  const lines = result.lines.filter(
    (l) => l.ledger === 'capacity' && l.kind === 'availability',
  );

  it('unit availability is the union (5400 s at 1/s), shares sum to 1 per segment', () => {
    expect(result.issues).toEqual([]);
    expect(dec(lines.reduce((s, l) => s.plus(l.quantity), new Dec(0)))).toBe(
      expected.primaryCauseAllocationTotalSeconds,
    );
    const shared = lines.filter((l) => l.evidence[0].share !== '1.00000000');
    expect(shared.map((l) => l.evidence[0].share)).toEqual([
      '0.50000000',
      '0.50000000',
    ]);
  });
});
