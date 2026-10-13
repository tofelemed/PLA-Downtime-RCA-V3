import { Dec, ZERO } from '../actuals/decimal';
import { LedgerTotals, LossLineDraft } from './accounting.types';
import { checkConservation } from './conservation';

const EPSILON = new Dec('0.000001');
const AT = new Date('2027-03-01T00:00:00Z');

function line(index: number, quantity: Dec): LossLineDraft {
  return {
    ledger: 'capacity',
    kind: 'availability',
    sliceId: 'S1',
    segmentStart: AT,
    segmentEnd: AT,
    quantity,
    uom: 't',
    basis: 'sustained_rate',
    rateVersionId: null,
    cause: null,
    scheduleClass: null,
    oeeComponent: null,
    flags: [],
    evidence: [],
    autoKey: `line-${index}`,
  };
}

function capacityTotals(capacity: Dec): LedgerTotals {
  return {
    sliceId: 'S1',
    ledger: 'capacity',
    uom: 't',
    capacity,
    exclusion: ZERO,
    availability: capacity,
    performance: ZERO,
    quality: ZERO,
    good: ZERO,
    gain: ZERO,
    attributed: capacity,
    residual: ZERO,
    target: null,
    actual: null,
    gap: null,
    overproduction: null,
    overAccounted: null,
    flags: [],
  };
}

describe('checkConservation — capacity identity on stored lines (LA-12)', () => {
  it('rounding many lines to the stored 8 places is not a conservation failure', () => {
    const third = new Dec(1).div(3);
    const lines = Array.from({ length: 400 }, (_, i) => line(i, third));
    const capacity = third.times(400);
    expect(
      checkConservation(lines, [capacityTotals(capacity)], EPSILON),
    ).toEqual([]);
  });

  it('a real imbalance beyond epsilon plus the rounding allowance still fails', () => {
    const lines = Array.from({ length: 400 }, (_, i) =>
      line(i, new Dec('0.25')),
    );
    const capacity = new Dec('100.00001');
    const codes = checkConservation(
      lines,
      [capacityTotals(capacity)],
      EPSILON,
    ).map((i) => i.code);
    expect(codes).toContain('CAPACITY_NOT_CONSERVED');
  });
});
