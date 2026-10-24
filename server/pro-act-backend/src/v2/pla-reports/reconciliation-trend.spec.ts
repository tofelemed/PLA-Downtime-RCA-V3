import { Dec, ZERO } from '../../domain/actuals/decimal';
import {
  DecisionLine,
  SliceReconciliation,
} from '../../domain/reconciliation/reconciliation.types';
import { PeriodState } from '../period-overview/period-states';
import {
  addTrendStates,
  trendAccumulator,
  trendView,
} from './reconciliation-trend';

const d = (value: number) => new Dec(value);

function slice(
  over: Partial<SliceReconciliation> & { target: Dec; actual: Dec },
): SliceReconciliation {
  const gap = over.target.minus(over.actual);
  const attributed = over.attributed ?? ZERO;
  const toleranceAdjustment = over.toleranceAdjustment ?? ZERO;
  return {
    sliceId: 's1',
    uom: 't',
    gap,
    attributed,
    toleranceAdjustment,
    unadjustedResidual: gap.minus(attributed),
    residual: gap.minus(attributed).minus(toleranceAdjustment),
    overAccounted: null,
    overproduction: gap.lt(ZERO) ? gap.neg() : ZERO,
    tolerance: ZERO,
    flags: [],
    ...over,
  };
}

function state(
  id: string,
  slices: SliceReconciliation[],
  extra: { lines?: DecisionLine[]; target?: Dec } = {},
): PeriodState {
  return {
    period: { id, localDate: '2026-10-14', shiftName: 'A' },
    run: { id: `run-${id}` },
    lines: extra.lines ?? [],
    rule: {
      mode: 'zero',
      value: ZERO,
      epsilon: d(0.000001),
      allowUnaccountedClassification: true,
      unaccountedTarget: extra.target,
    },
    reconciliation: { slices, candidates: [] },
  } as unknown as PeriodState;
}

const unaccountedLine = (quantity: number): DecisionLine => ({
  action: 'manual',
  autoKey: null,
  sliceId: 's1',
  kind: 'unaccounted_classified',
  quantity: d(quantity),
  baseQuantity: null,
  missingCode: false,
});

const bucketOfStates = (states: PeriodState[]) => {
  const acc = trendAccumulator();
  addTrendStates(acc, states, { groupBy: 'day', weekStart: 'monday' });
  return trendView(acc, 'day').buckets[0];
};

describe('reconciliation trend: unexplained loss (SME R7)', () => {
  it('reports unexplained loss against plan and against the shortfall (1 % of plan is 10 % of the shortfall)', () => {
    const bucket = bucketOfStates([
      state(
        'p1',
        [slice({ target: d(1000), actual: d(900), attributed: d(90) })],
        {
          target: d(0.02),
        },
      ),
    ]);
    expect(bucket).toMatchObject({
      plan: '1000',
      shortfall: '100',
      unexplained: '10',
      unexplainedOfPlan: '0.01',
      unexplainedOfShortfall: '0.1',
      unexplainedTarget: '0.02',
      unexplainedAboveTarget: true,
    });
  });

  it('a classified Unaccounted line and a tolerance adjustment stay unexplained (a label is not proof)', () => {
    const bucket = bucketOfStates([
      state(
        'p1',
        [
          slice({
            target: d(1000),
            actual: d(900),
            attributed: d(96),
            toleranceAdjustment: d(4),
          }),
        ],
        { lines: [unaccountedLine(6)] },
      ),
    ]);
    expect(bucket).toMatchObject({
      unexplained: '10',
      unexplainedOfShortfall: '0.1',
    });
  });

  it('the shortfall ratio is undefined without a shortfall; differing targets give no single target', () => {
    const bucket = bucketOfStates([
      state('p1', [slice({ target: d(100), actual: d(100) })], {
        target: d(0.02),
      }),
      state('p2', [slice({ target: d(100), actual: d(110) })], {
        target: d(0.05),
      }),
    ]);
    expect(bucket).toMatchObject({
      plan: '200',
      shortfall: '0',
      unexplained: '0',
      unexplainedOfPlan: '0',
      unexplainedOfShortfall: null,
      unexplainedTarget: null,
      unexplainedAboveTarget: null,
    });
  });
});

const viewOf = (states: PeriodState[]) => {
  const acc = trendAccumulator();
  addTrendStates(acc, states, { groupBy: 'day', weekStart: 'monday' });
  return trendView(acc, 'day');
};

const dayState = (
  id: string,
  localDate: string,
  slices: SliceReconciliation[],
): PeriodState => {
  const base = state(id, slices);
  return { ...base, period: { ...base.period, localDate } };
};

describe('reconciliation trend: actual, explained and window totals', () => {
  it('reports actual and explained per bucket', () => {
    const bucket = bucketOfStates([
      state('p1', [
        slice({ target: d(100), actual: d(80), attributed: d(15) }),
      ]),
    ]);
    expect(bucket).toMatchObject({
      plan: '100',
      actual: '80',
      shortfall: '20',
      unexplained: '5',
      explained: '15',
    });
  });

  it('totals add the buckets of one unit of measure', () => {
    const view = viewOf([
      dayState('p1', '2026-10-14', [slice({ target: d(100), actual: d(80) })]),
      dayState('p2', '2026-10-15', [slice({ target: d(50), actual: d(50) })]),
    ]);
    expect(view.buckets).toHaveLength(2);
    expect(view.totals).toHaveLength(1);
    expect(view.totals[0]).toMatchObject({
      key: 'total',
      uom: 't',
      plan: '150',
      actual: '130',
      shortfall: '20',
      unexplained: '20',
      explained: '0',
      unexplainedOfPlan: '0.13333333', // 20 / 150 — not the bucket average 0.1
      unexplainedOfShortfall: '1',
      periods: 2,
      excludedSlices: 0,
    });
  });

  it('keeps units of measure apart in totals', () => {
    const view = viewOf([
      state('p1', [
        slice({ target: d(100), actual: d(80) }),
        slice({ sliceId: 's2', uom: 'm3', target: d(40), actual: d(30) }),
      ]),
    ]);
    expect(view.totals.map((t) => [t.uom, t.plan, t.actual])).toEqual([
      ['m3', '40', '30'],
      ['t', '100', '80'],
    ]);
  });

  it('explained never goes below zero', () => {
    const bucket = bucketOfStates([
      state('p1', [slice({ target: d(100), actual: d(90) })], {
        lines: [unaccountedLine(6)],
      }),
    ]);
    expect(bucket).toMatchObject({
      shortfall: '10',
      unexplained: '16',
      explained: '0',
    });
  });

  it('totals are null when no slice is computable', () => {
    const noRun = {
      ...state('p2', []),
      run: null,
      reconciliation: null,
    } as unknown as PeriodState;
    const view = viewOf([
      state('p1', [{ ...slice({ target: d(100), actual: d(80) }), gap: null }]),
      noRun,
    ]);
    expect(view.totals).toEqual([
      expect.objectContaining({
        key: 'total',
        uom: null,
        plan: null,
        actual: null,
        explained: null,
        unexplainedOfPlan: null,
        excludedSlices: 1,
      }),
      expect.objectContaining({
        key: 'total',
        uom: 't',
        plan: null,
        actual: null,
        shortfall: null,
        unexplained: null,
        explained: null,
        unexplainedTarget: null,
        periods: 1,
        excludedSlices: 1,
      }),
    ]);
  });
});
