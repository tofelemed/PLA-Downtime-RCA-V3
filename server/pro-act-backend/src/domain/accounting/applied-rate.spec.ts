import { Dec, formatDec } from '../actuals/decimal';
import {
  LossEvent,
  LossLineDraft,
  PeriodAccountingInput,
  RateVersion,
  Segment,
} from './accounting.types';
import { withAppliedRates } from './applied-rate';
import { computePeriodAccounting } from './period-accounting';

const T0 = Date.parse('2027-03-01T02:30:00Z');
const at = (minutes: number) => new Date(T0 + minutes * 60_000);

function stop(id: string, from: number, to: number): LossEvent {
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
  };
}

function input(target: string, events: LossEvent[]): PeriodAccountingInput {
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
        target,
        actuals: { gross: '300', good: '300', uom: 't' },
        concurrent: false,
      },
    ],
  };
}

const find = (all: readonly LossLineDraft[], ledger: string, kind: string) =>
  all.find((l) => l.ledger === ledger && l.kind === kind)!;

describe('applied rate of loss lines (UX D-2)', () => {
  it('records the planning rate scaled to target on plan lines without changing quantities (SME Q1)', () => {
    const result = computePeriodAccounting(input('360', [stop('S', 60, 120)]));
    const planStop = find(result.lines, 'plan', 'availability');
    expect(formatDec(planStop.quantity)).toBe('45');
    expect(planStop.appliedRate).toEqual({ value: '45', timebase: 'h' });
    const capacityStop = find(result.lines, 'capacity', 'availability');
    expect(formatDec(capacityStop.quantity)).toBe('100');
    expect(capacityStop.appliedRate).toEqual({ value: '100', timebase: 'h' });
  });

  it('records the planning rate itself when the plan matches planning capacity', () => {
    const result = computePeriodAccounting(input('720', [stop('S', 60, 120)]));
    expect(find(result.lines, 'plan', 'availability').appliedRate).toEqual({
      value: '90',
      timebase: 'h',
    });
  });

  it('lines without a rate (residual, measured) carry no applied rate', () => {
    const result = computePeriodAccounting(input('360', [stop('S', 60, 120)]));
    const residual = find(result.lines, 'plan', 'residual');
    expect(residual.appliedRate).toBeUndefined();
  });

  describe('withAppliedRates', () => {
    const rate = (id: string, value: string): RateVersion => ({
      id,
      rate: value,
      timebase: 'h',
      from: at(0),
      to: null,
    });
    const segment = (planning: RateVersion): Segment =>
      ({ planning, sustained: null }) as unknown as Segment;
    const line = (extra: Partial<LossLineDraft>): LossLineDraft =>
      ({
        basis: 'planning_rate',
        rateVersionId: 'p',
        flags: [],
        quantity: new Dec(1),
        ...extra,
      }) as LossLineDraft;

    it('leaves product-run shares, measured lines and unknown versions without a rate', () => {
      const segments = [segment(rate('p', '45'))];
      const [pooled, measured, unknown] = withAppliedRates(
        [
          line({ flags: ['product_run_share'] }),
          line({ basis: 'measured' }),
          line({ rateVersionId: 'other' }),
        ],
        segments,
        'planning',
      );
      expect(pooled.appliedRate).toBeUndefined();
      expect(measured.appliedRate).toBeUndefined();
      expect(unknown.appliedRate).toBeUndefined();
    });

    it('a version seen with two values has no single applied rate', () => {
      const [found] = withAppliedRates(
        [line({})],
        [segment(rate('p', '45')), segment(rate('p', '50'))],
        'planning',
      );
      expect(found.appliedRate).toBeUndefined();
    });
  });
});
