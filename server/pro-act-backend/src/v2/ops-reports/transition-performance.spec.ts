import { toTransitionRow, TransitionRow } from './transition-performance';
import { summarizeTransitions } from './transition-pairs';

const base: TransitionRow = {
  event_id: 'e1',
  unit_id: 'u1',
  unit_name: 'Line 1',
  start_time: new Date('2027-03-01T03:00:00Z'),
  end_time: new Date('2027-03-01T07:00:00Z'),
  seconds: '14400.000',
  from_product_id: 'a',
  from_product: 'HD5218',
  to_product_id: 'b',
  to_product: 'EX3',
  catalyst_family: null,
  operating_mode: null,
  standard_id: 's1',
  reference_seconds: '10800.000',
  reference_offgrade: '12.5',
  uom: 't',
  allowance_loss: '30',
  excess_loss: '10',
  off_grade: '8',
  no_standard: false,
  lines: 3,
};

describe('transition performance (R5)', () => {
  it('measures a transition against the standard the calculation applied', () => {
    expect(toTransitionRow(base)).toMatchObject({
      seconds: '14400',
      referenceSeconds: '10800',
      excessSeconds: '3600',
      allowanceLoss: '30',
      excessLoss: '10',
      calculated: true,
      noStandard: false,
    });
  });

  it('has no excess without a standard or while running, and is "not calculated" without lines', () => {
    const none = toTransitionRow({
      ...base,
      standard_id: null,
      reference_seconds: null,
      no_standard: true,
    });
    expect(none).toMatchObject({ excessSeconds: null, noStandard: true });
    const running = toTransitionRow({
      ...base,
      end_time: null,
      seconds: null,
      lines: 0,
      no_standard: null,
    });
    expect(running).toMatchObject({
      excessSeconds: null,
      calculated: false,
      noStandard: false,
    });
  });

  it('summarizes each product change over its ended transitions, worst mean excess first', () => {
    const rows = [
      toTransitionRow(base),
      toTransitionRow({
        ...base,
        event_id: 'e2',
        seconds: '7200',
        end_time: new Date('2027-03-02T05:00:00Z'),
      }),
      toTransitionRow({
        ...base,
        event_id: 'e3',
        end_time: null,
        seconds: null,
      }),
      toTransitionRow({
        ...base,
        event_id: 'e4',
        from_product_id: 'b',
        to_product_id: 'a',
        seconds: '3600',
        reference_seconds: '7200',
      }),
    ];
    const [first, second] = summarizeTransitions(rows);
    expect(first).toMatchObject({
      fromProductId: 'a',
      transitions: 3,
      ended: 2,
      meanSeconds: '10800',
      bestSeconds: '7200',
      worstSeconds: '14400',
      withStandard: 2,
      overStandard: 1,
      meanExcessSeconds: '0',
    });
    expect(second).toMatchObject({
      fromProductId: 'b',
      meanExcessSeconds: '-3600',
      overStandard: 0,
    });
  });
});
