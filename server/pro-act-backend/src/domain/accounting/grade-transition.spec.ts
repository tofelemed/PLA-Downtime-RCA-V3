import { Dec, formatDec } from '../actuals/decimal';
import {
  LossEvent,
  LossLineDraft,
  PeriodAccountingInput,
  TransitionStandard,
} from './accounting.types';
import { computePeriodAccounting } from './period-accounting';

/**
 * LA-08 (SME Q9 / Q10 / E1 / E3): a grade transition claims the capacity of its running time, split into
 * the off-grade it made (quality, its own class) and the rate deficit (performance); the part within the
 * approved transition standard is an allowance, the rest an overrun — or all of it, flagged
 * `no_transition_standard`, when the matrix has no entry. 30 t/h, 8 h, transition A→B 02:00–05:00.
 */
const T0 = Date.parse('2027-03-01T00:00:00Z');
const at = (hours: number) => new Date(T0 + hours * 3_600_000);
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

const transition = (extra: Partial<LossEvent> = {}) =>
  event('GT', 2, 5, {
    physicalType: 'grade_transition',
    scheduleClass: 'planned',
    oeeComponent: 'performance',
    impactMode: 'measured',
    quantity: '40',
    transition: { fromProductId: 'A', toProductId: 'B' },
    ...extra,
  });

const standard = (
  extra: Partial<TransitionStandard> = {},
): TransitionStandard => ({
  id: 'STD-AB',
  fromProductId: 'A',
  toProductId: 'B',
  referenceSeconds: '7560',
  referenceOffgradeQuantity: null,
  from: at(-100),
  to: null,
  ...extra,
});

function input(
  events: LossEvent[],
  standards: TransitionStandard[],
  actuals = { gross: '190', good: '150', uom: 't' },
): PeriodAccountingInput {
  const window = { start: at(0), end: at(8) };
  return {
    window,
    periodExcluded: false,
    periodExclusionKind: null,
    schedule: [],
    events,
    asOf: window.end,
    transitionStandards: standards,
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
          { id: 'sus', rate: '30', timebase: 'h', from: at(-1), to: null },
        ],
        planningRates: [
          { id: 'plan', rate: '30', timebase: 'h', from: at(-1), to: null },
        ],
        target: '240',
        actuals,
        concurrent: false,
      },
    ],
  };
}

const pick = (
  lines: readonly LossLineDraft[],
  ledger: string,
  kind: string,
  component?: string,
) =>
  lines.filter(
    (l) =>
      l.ledger === ledger &&
      l.kind === kind &&
      (component === undefined || l.oeeComponent === component),
  );

describe('grade transitions (LA-08, engine 2.5.4)', () => {
  it('splits the transition into allowance and overrun at the matrix reference (2.1 h of 3 h)', () => {
    const result = computePeriodAccounting(input([transition()], [standard()]));
    expect(result.issues).toEqual([]);
    const { lines } = result;
    const allowance = pick(lines, 'capacity', 'transition_allowance');
    const excess = pick(lines, 'capacity', 'transition_excess');
    expect(sum(pick(allowance, 'capacity', 'transition_allowance', 'performance'))).toBe('35');
    expect(sum(pick(allowance, 'capacity', 'transition_allowance', 'quality'))).toBe('28');
    expect(sum(pick(excess, 'capacity', 'transition_excess', 'performance'))).toBe('15');
    expect(sum(pick(excess, 'capacity', 'transition_excess', 'quality'))).toBe('12');
    expect(excess.every((l) => l.flags.includes('transition_overrun'))).toBe(true);
    expect(
      [...allowance, ...excess].every((l) =>
        l.flags.includes('transition_standard:STD-AB'),
      ),
    ).toBe(true);
    const offGrade = [...allowance, ...excess].filter(
      (l) => l.oeeComponent === 'quality',
    );
    expect(
      offGrade.every((l) => l.flags.includes('quality_class:transition_off_grade')),
    ).toBe(true);
    expect([...allowance, ...excess].every((l) => l.cause?.eventId === 'GT')).toBe(true);
  });

  it('keeps the OEE components whole: capacity P and Q include the transition, residual 0', () => {
    const { totals } = computePeriodAccounting(input([transition()], [standard()]));
    const capacity = totals.find((t) => t.ledger === 'capacity')!;
    expect(formatDec(capacity.performance!)).toBe('50');
    expect(formatDec(capacity.quality!)).toBe('40');
    expect(formatDec(capacity.residual!)).toBe('0');
    const plan = totals.find((t) => t.ledger === 'plan')!;
    expect(formatDec(plan.performance!)).toBe('50');
    expect(formatDec(plan.quality!)).toBe('40');
    expect(formatDec(plan.residual!)).toBe('0');
  });

  it('mirrors the split in the plan ledger at the planned rate', () => {
    const { lines } = computePeriodAccounting(input([transition()], [standard()]));
    expect(sum(pick(lines, 'plan', 'transition_allowance'))).toBe('63');
    expect(sum(pick(lines, 'plan', 'transition_excess'))).toBe('27');
  });

  it('with no matrix entry the whole transition is loss, flagged no_transition_standard (no reference invented)', () => {
    const { lines, issues } = computePeriodAccounting(
      input([transition()], [standard({ fromProductId: 'B', toProductId: 'A' })]),
    );
    expect(issues).toEqual([]);
    expect(pick(lines, 'capacity', 'transition_allowance')).toEqual([]);
    const excess = pick(lines, 'capacity', 'transition_excess');
    expect(sum(excess)).toBe('90');
    expect(excess.every((l) => l.flags.includes('no_transition_standard'))).toBe(true);
    expect(excess.some((l) => l.flags.includes('transition_overrun'))).toBe(false);
  });

  it('uses the standard in force at the transition start (effective-dated)', () => {
    const { lines } = computePeriodAccounting(
      input([transition()], [standard({ from: at(-100), to: at(1) })]),
    );
    expect(sum(pick(lines, 'capacity', 'transition_excess'))).toBe('90');
  });

  it('a reference off-grade quantity bounds the off-grade allowance in tonnes', () => {
    const { lines } = computePeriodAccounting(
      input([transition()], [standard({ referenceOffgradeQuantity: '30' })]),
    );
    expect(sum(pick(lines, 'capacity', 'transition_allowance', 'quality'))).toBe('30');
    expect(sum(pick(lines, 'capacity', 'transition_excess', 'quality'))).toBe('10');
    expect(sum(pick(lines, 'capacity', 'transition_allowance', 'performance'))).toBe('35');
  });

  it('a transition within its reference has no overrun line', () => {
    const { lines } = computePeriodAccounting(
      input([transition()], [standard({ referenceSeconds: '14400' })]),
    );
    expect(pick(lines, 'capacity', 'transition_excess')).toEqual([]);
    expect(sum(pick(lines, 'capacity', 'transition_allowance'))).toBe('90');
  });

  it('a stop inside the transition stays availability; the transition claims only running time', () => {
    const trip = event('TRIP', 3, 3.5);
    const result = computePeriodAccounting(
      input([transition(), trip], [standard()]),
    );
    expect(result.issues).toEqual([]);
    expect(sum(pick(result.lines, 'capacity', 'availability'))).toBe('15');
    const transitionLines = [
      ...pick(result.lines, 'capacity', 'transition_allowance'),
      ...pick(result.lines, 'capacity', 'transition_excess'),
    ];
    expect(sum(transitionLines)).toBe('75');
  });

  it('auto keys stay unique across the rate and off-grade parts', () => {
    const { lines, issues } = computePeriodAccounting(
      input([transition()], [standard()]),
    );
    expect(issues.filter((i) => i.code === 'DUPLICATE_AUTO_KEY')).toEqual([]);
    expect(new Set(lines.map((l) => l.autoKey)).size).toBe(lines.length);
  });
});

describe('trip recovery (SME Q10 / E1)', () => {
  it('ramp-up and startup-quality lines keep their own cause and are flagged trip_recovery', () => {
    const trip = event('TRIP', 1, 2);
    const rampUp = event('RAMP', 2, 3, {
      physicalType: 'slowdown',
      oeeComponent: 'performance',
      impactMode: 'fractional',
      impactFraction: '0.5',
      recoveryOfEventId: 'TRIP',
    });
    const startupScrap = event('SCRAP', 2, 3, {
      physicalType: 'quality_loss',
      oeeComponent: 'quality',
      impactMode: 'measured',
      quantity: '5',
      recoveryOfEventId: 'TRIP',
    });
    const { lines, issues } = computePeriodAccounting(
      input([trip, rampUp, startupScrap], [], {
        gross: '195',
        good: '190',
        uom: 't',
      }),
    );
    expect(issues).toEqual([]);
    const ramp = pick(lines, 'capacity', 'performance').filter(
      (l) => l.cause?.eventId === 'RAMP',
    );
    expect(sum(ramp)).toBe('15');
    expect(ramp.every((l) => l.flags.includes('trip_recovery'))).toBe(true);
    expect(ramp[0].cause?.recoveryOfEventId).toBe('TRIP');
    const scrap = pick(lines, 'capacity', 'quality').filter(
      (l) => l.cause?.eventId === 'SCRAP',
    );
    expect(sum(scrap)).toBe('5');
    expect(scrap.every((l) => l.flags.includes('trip_recovery'))).toBe(true);
    const stop = pick(lines, 'capacity', 'availability');
    expect(stop.some((l) => l.flags.includes('trip_recovery'))).toBe(false);
  });
});
