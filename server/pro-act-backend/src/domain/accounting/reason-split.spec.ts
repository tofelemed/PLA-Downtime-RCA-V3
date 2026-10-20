import { Dec } from '../actuals/decimal';
import { LossEvent, SegmentCause } from './accounting.types';
import { rateClaims } from './claims';
import { causeKey, splitAmountByReason, splitByReasons } from './reason-split';
import { segmentSlice } from './segmentation';

const T0 = Date.parse('2027-03-01T06:00:00Z');
const at = (seconds: number) => new Date(T0 + seconds * 1000);

const event = (
  id: string,
  extra: Partial<LossEvent> = {},
  span: [number, number] = [0, 3600],
): LossEvent => ({
  eventId: id,
  revisionId: null,
  revision: null,
  occurrenceId: `occ-${id}`,
  physicalType: 'downtime',
  start: at(span[0]),
  end: at(span[1]),
  scheduleClass: 'unplanned',
  oeeComponent: 'availability',
  impactMode: 'full_stop',
  impactFraction: null,
  quantity: null,
  reasonCodeId: 'r-1',
  impactCodeId: null,
  failureMode: null,
  ...extra,
});

const THIRDS = [
  { reasonCodeId: 'r-1', weight: '0.33333334' },
  { reasonCodeId: 'r-2', weight: '0.33333333' },
  { reasonCodeId: 'r-3', weight: '0.33333333' },
];

/** D-T5: the share a stop received is split by its weights; the segment still shares exactly 1. */
describe('splitByReasons', () => {
  it('returns unweighted causes unchanged (the same objects)', () => {
    const causes: SegmentCause[] = [
      { event: event('E1'), share: new Dec(1) },
      {
        event: event('E2', {
          reasonWeights: [{ reasonCodeId: 'r-1', weight: '1' }],
        }),
        share: new Dec(0),
      },
    ];
    const split = splitByReasons(causes);
    expect(split).toHaveLength(2);
    expect(split[0]).toBe(causes[0]);
    expect(split[1]).toBe(causes[1]);
  });

  it('splits a half share in thirds with the remainder on the primary reason (Σ = the share)', () => {
    const weighted = event('E1', { reasonWeights: THIRDS, reasonCode: 'TRIP' });
    const split = splitByReasons([
      { event: weighted, share: new Dec('0.5') },
      { event: event('E2'), share: new Dec('0.5') },
    ]);
    expect(
      split.map((c) => [c.event.reasonCodeId, c.share.toFixed(8)]),
    ).toEqual([
      ['r-1', '0.16666668'],
      ['r-2', '0.16666666'],
      ['r-3', '0.16666666'],
      ['r-1', '0.50000000'],
    ]);
    expect(split.reduce((s, c) => s.plus(c.share), new Dec(0)).eq(1)).toBe(
      true,
    );
    expect(split[0].event.reasonCode).toBe('TRIP');
    expect(split[1].event.reasonCode).toBeNull();
    expect(split.map((c) => causeKey(c.event))).toEqual([
      'E1|r-1',
      'E1|r-2',
      'E1|r-3',
      'E2',
    ]);
  });

  it('gives a weighted micro-stop one rate claim per reason', () => {
    const micro = event(
      'M1',
      {
        reasonWeights: [
          { reasonCodeId: 'r-1', weight: '0.60000000' },
          { reasonCodeId: 'r-2', weight: '0.40000000' },
        ],
      },
      [600, 630],
    );
    const window = { start: at(0), end: at(3600) };
    const segments = segmentSlice(
      {
        window,
        periodExcluded: false,
        periodExclusionKind: null,
        schedule: [],
        events: [micro],
        slices: [],
        asOf: window.end,
        policy: {
          microStopSeconds: 60,
          derateComponent: 'performance',
          plannedStopsInsideScheduleReduceAvailability: true,
          epsilon: '0.000001',
        },
      },
      {
        sliceId: 'S1',
        window,
        uom: 't',
        sustainedRates: [
          { id: 'sus', rate: '3600', timebase: 'h', from: at(-1), to: null },
        ],
        planningRates: [],
        target: null,
        actuals: null,
        concurrent: false,
      },
    );
    const claims = rateClaims(segments, 'sustained');
    expect(
      claims.map((c) => [c.event.reasonCodeId, c.quantity.toFixed()]),
    ).toEqual([
      ['r-1', '18'],
      ['r-2', '12'],
    ]);
  });
});

describe('splitAmountByReason', () => {
  it('splits an amount by weight (Σ = the amount) and keeps an unweighted one whole', () => {
    const weighted = event('E1', { reasonWeights: THIRDS });
    const parts = splitAmountByReason(weighted, new Dec(3600));
    expect(
      parts.map((p) => [p.event.reasonCodeId, p.amount.toFixed()]),
    ).toEqual([
      ['r-1', '1200.000024'],
      ['r-2', '1199.999988'],
      ['r-3', '1199.999988'],
    ]);
    expect(parts.reduce((s, p) => s.plus(p.amount), new Dec(0)).eq(3600)).toBe(
      true,
    );
    const plain = event('E2');
    expect(splitAmountByReason(plain, new Dec(60))).toEqual([
      { event: plain, amount: new Dec(60) },
    ]);
  });
});
