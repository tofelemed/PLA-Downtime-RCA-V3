import { Dec, formatDec, ZERO } from '../actuals/decimal';
import { SliceReconciliation } from './reconciliation.types';
import {
  buildWaterfall,
  capacitySteps,
  PLAN_STEP_KEYS,
  planKindTotals,
  planSteps,
} from './waterfall';

const d = (value: string | number) => new Dec(value);

function slice(
  target: number,
  actual: number,
  attributed: number,
): SliceReconciliation {
  const gap = d(target).minus(actual);
  const residual = gap.minus(attributed);
  const overproducing = gap.lt(0);
  return {
    sliceId: 's1',
    uom: 't',
    target: d(target),
    actual: d(actual),
    gap,
    attributed: d(attributed),
    declaredGain: ZERO,
    toleranceAdjustment: ZERO,
    unadjustedResidual: residual,
    residual,
    overAccounted: !overproducing && residual.lt(0) ? residual.neg() : ZERO,
    overproduction: overproducing ? gap.neg() : ZERO,
    tolerance: ZERO,
    flags: [],
  };
}

const plan = (s: SliceReconciliation, kinds: Array<[string, number]>) =>
  buildWaterfall(
    { key: 'target', value: s.target as Dec },
    planSteps(s, new Map(kinds.map(([k, v]) => [k, d(v)]))),
    PLAN_STEP_KEYS,
    { key: 'actual', value: s.actual as Dec },
  );

const shape = (w: ReturnType<typeof plan>) =>
  w.bars.map((b) => [b.key, b.delta ? formatDec(b.delta) : formatDec(b.end)]);

describe('ledger waterfall (plan 3.5)', () => {
  it('T15: residual 10 is an unaccounted step and the bars close to actual', () => {
    const w = plan(slice(1000, 850, 140), [['availability', 140]]);
    expect(w.closes).toBe(true);
    expect(shape(w)).toEqual([
      ['target', '1000'],
      ['availability', '-140'],
      ['unaccounted', '-10'],
      ['actual', '850'],
    ]);
  });

  it('SME Q2: a recovery gain is its own upward bar; losses stay gross (T28)', () => {
    const w = plan(slice(630, 550, 80), [
      ['availability', 90],
      ['quality', 20],
      ['gain', -30],
    ]);
    expect(w.closes).toBe(true);
    expect(shape(w)).toEqual([
      ['target', '630'],
      ['availability', '-90'],
      ['quality', '-20'],
      ['gain', '30'],
      ['actual', '550'],
    ]);
  });

  it('Task 13: a declared day 23 + 11 + 6 − 8 closes at 208 with the recovery as its gain step', () => {
    const declared = { ...slice(240, 208, 32), declaredGain: d(8) };
    const w = plan(declared, [
      ['availability', 23],
      ['performance', 11],
      ['quality', 6],
    ]);
    expect(w.closes).toBe(true);
    expect(shape(w)).toEqual([
      ['target', '240'],
      ['availability', '-23'],
      ['performance', '-11'],
      ['quality', '-6'],
      ['gain', '8'],
      ['actual', '208'],
    ]);
  });

  it('T16: over-accounted 10 raises the running total back to actual', () => {
    const w = plan(slice(1000, 850, 160), [['availability', 160]]);
    expect(w.closes).toBe(true);
    expect(shape(w)).toContainEqual(['over_accounted', '10']);
  });

  it('T17: overproduction 50 with 20 attributed is split into overproduction and the conflict offset', () => {
    const w = plan(slice(1000, 1050, 20), [['availability', 20]]);
    expect(w.closes).toBe(true);
    expect(shape(w)).toEqual([
      ['target', '1000'],
      ['availability', '-20'],
      ['overproduction', '50'],
      ['conflict_offset', '20'],
      ['actual', '1050'],
    ]);
  });

  it('capacity identity: capacity − exclusion − A − P − Q + gain − residual = good', () => {
    const steps = capacitySteps({
      capacity: d(1200),
      exclusion: d(100),
      availability: d(100),
      performance: d(80),
      quality: d(10),
      gain: d(5),
      residual: d(65),
    });
    const w = buildWaterfall(
      { key: 'capacity', value: d(1200) },
      steps,
      [
        'schedule_exclusion',
        'availability',
        'performance',
        'quality',
        'gain',
        'residual',
      ],
      { key: 'actual', value: d(850) },
    );
    expect(w.closes).toBe(true);
  });

  it('reports a waterfall that does not close instead of hiding it', () => {
    const w = buildWaterfall(
      { key: 'target', value: d(100) },
      new Map([['availability', d(-10)]]),
      PLAN_STEP_KEYS,
      { key: 'actual', value: d(80) },
    );
    expect(w.closes).toBe(false);
  });

  it('per-kind totals apply decisions: rejected candidates count 0, manual lines add, tolerance lines kept apart', () => {
    const totals = planKindTotals(
      's1',
      [
        { autoKey: 'k1', sliceId: 's1', kind: 'availability', quantity: d(90) },
        { autoKey: 'k2', sliceId: 's1', kind: 'performance', quantity: d(30) },
      ],
      [
        {
          autoKey: 'k1',
          sliceId: 's1',
          state: 'accepted',
          effectiveQuantity: d(90),
        },
        {
          autoKey: 'k2',
          sliceId: 's1',
          state: 'rejected',
          effectiveQuantity: ZERO,
        },
      ],
      [
        {
          action: 'manual',
          autoKey: null,
          sliceId: 's1',
          kind: 'quality',
          quantity: d(5),
          baseQuantity: null,
          missingCode: false,
        },
        {
          action: 'tolerance',
          autoKey: null,
          sliceId: 's1',
          kind: 'tolerance_adjustment',
          quantity: d('0.5'),
          baseQuantity: null,
          missingCode: false,
        },
      ],
    );
    expect(
      Object.fromEntries([...totals].map(([k, v]) => [k, formatDec(v)])),
    ).toEqual({
      availability: '90',
      performance: '0',
      quality: '5',
      tolerance_adjustment: '0.5',
    });
  });
});
