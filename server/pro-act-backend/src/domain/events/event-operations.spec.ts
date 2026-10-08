import { durationSeconds, Interval } from '../time/interval-algebra';
import {
  MergeCandidate,
  OperationViolation,
  planMerge,
  splitAmount,
  splitInterval,
  sumAmounts,
  validateCloseEnd,
} from './event-operations';

const at = (time: string): Date => new Date(`2026-10-08T${time}:00.000Z`);
const NOW = at('23:00');
const POLICY = { maxGapSeconds: 0, overrideClassification: false };

/** Deterministic pseudo-random sequence (LCG) for property-style checks. */
function sequence(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

function candidate(
  id: string,
  interval: Interval,
  overrides: Partial<MergeCandidate> = {},
): MergeCandidate {
  return {
    id,
    unitId: 'u1',
    interval,
    classification: { physicalType: 'downtime', scheduleClass: 'unplanned' },
    coding: { reasonCodeId: 'r1', impactCodeId: null },
    ...overrides,
  };
}

function violationCode(work: () => unknown): string | undefined {
  try {
    work();
  } catch (error) {
    if (error instanceof OperationViolation) return error.code;
    throw error;
  }
  return undefined;
}

describe('splitInterval (DT09)', () => {
  const stop = { start: at('10:00'), end: at('12:00') };

  it('splits a closed stop into two adjacent children', () => {
    const [first, second] = splitInterval(stop, at('11:00'), NOW);
    expect(first).toEqual({ start: at('10:00'), end: at('11:00') });
    expect(second).toEqual({ start: at('11:00'), end: at('12:00') });
  });

  it('keeps the second child open when the parent is open', () => {
    const [, second] = splitInterval(
      { start: at('10:00'), end: null },
      at('11:00'),
      NOW,
    );
    expect(second.end).toBeNull();
  });

  it.each([
    ['at the start', at('10:00')],
    ['at the end', at('12:00')],
    ['before the start', at('09:00')],
    ['after the end', at('13:00')],
    ['an invalid instant', new Date(Number.NaN)],
  ])('rejects a split %s', (_label, splitAt) => {
    expect(violationCode(() => splitInterval(stop, splitAt, NOW))).toBe(
      'SPLIT_OUTSIDE_INTERVAL',
    );
  });

  it('rejects a split of an open event at or after now', () => {
    const open = { start: at('10:00'), end: null };
    expect(violationCode(() => splitInterval(open, NOW, NOW))).toBe(
      'SPLIT_OUTSIDE_INTERVAL',
    );
  });

  it('conserves the duration for any inside instant (property)', () => {
    const next = sequence(42);
    for (let run = 0; run < 200; run++) {
      const start = at('00:00').getTime() + Math.floor(next() * 3_600_000);
      const length = 2 + Math.floor(next() * 36_000_000);
      const parent = { start: new Date(start), end: new Date(start + length) };
      const cut = new Date(start + 1 + Math.floor(next() * (length - 1)));
      const [a, b] = splitInterval(parent, cut, NOW);
      expect((durationSeconds(a) ?? 0) + (durationSeconds(b) ?? 0)).toBeCloseTo(
        durationSeconds(parent) ?? 0,
        6,
      );
      expect(a.end).toEqual(b.start);
    }
  });
});

describe('splitAmount / sumAmounts', () => {
  const parts: [Interval, Interval] = [
    { start: at('10:00'), end: at('10:30') },
    { start: at('10:30'), end: at('12:00') },
  ];

  it('prorates by duration and conserves the total', () => {
    expect(splitAmount(100, parts)).toEqual([25, 75]);
    const next = sequence(7);
    for (let run = 0; run < 100; run++) {
      const total = Math.round(next() * 1e10) / 1e4;
      const [a, b] = splitAmount(total, parts);
      expect(sumAmounts([a, b])).toBeCloseTo(total, 8);
    }
  });

  it('gives everything to the running child of an open parent', () => {
    expect(
      splitAmount(10, [
        { start: at('10:00'), end: at('11:00') },
        { start: at('11:00'), end: null },
      ]),
    ).toEqual([0, 10]);
  });

  it('keeps null as null', () => {
    expect(splitAmount(null, parts)).toEqual([null, null]);
    expect(sumAmounts([null, undefined])).toBeNull();
    expect(sumAmounts([1.5, null, 2])).toBe(3.5);
  });
});

describe('planMerge (DT09)', () => {
  it('merges adjacent intervals into their union, ordered by start', () => {
    const plan = planMerge(
      [
        candidate('b', { start: at('11:00'), end: at('12:00') }),
        candidate('a', { start: at('10:00'), end: at('11:00') }),
      ],
      POLICY,
    );
    expect(plan.ordered.map(({ id }) => id)).toEqual(['a', 'b']);
    expect(plan.interval).toEqual({ start: at('10:00'), end: at('12:00') });
    expect(plan.coding).toEqual({ reasonCodeId: 'r1', impactCodeId: null });
  });

  it('merges overlapping and contained intervals', () => {
    const plan = planMerge(
      [
        candidate('a', { start: at('10:00'), end: at('11:30') }),
        candidate('b', { start: at('10:15'), end: at('10:45') }),
        candidate('c', { start: at('11:00'), end: at('12:00') }),
      ],
      POLICY,
    );
    expect(plan.interval).toEqual({ start: at('10:00'), end: at('12:00') });
  });

  it('keeps the merged event open when a contributor is open', () => {
    const plan = planMerge(
      [
        candidate('a', { start: at('10:00'), end: at('11:00') }),
        candidate('b', { start: at('11:00'), end: null }),
      ],
      POLICY,
    );
    expect(plan.interval.end).toBeNull();
  });

  it('accepts a gap within the policy and spans it', () => {
    const plan = planMerge(
      [
        candidate('a', { start: at('10:00'), end: at('11:00') }),
        candidate('b', { start: at('11:05'), end: at('12:00') }),
      ],
      { ...POLICY, maxGapSeconds: 300 },
    );
    expect(plan.interval).toEqual({ start: at('10:00'), end: at('12:00') });
  });

  it('fills coding fields from later events when the first has none', () => {
    const plan = planMerge(
      [
        candidate(
          'a',
          { start: at('10:00'), end: at('11:00') },
          {
            coding: { reasonCodeId: null },
          },
        ),
        candidate('b', { start: at('11:00'), end: at('12:00') }),
      ],
      POLICY,
    );
    expect(plan.coding.reasonCodeId).toBe('r1');
  });

  it.each<[string, MergeCandidate[], string]>([
    [
      'a single event',
      [candidate('a', { start: at('10:00'), end: at('11:00') })],
      'MERGE_TOO_FEW_EVENTS',
    ],
    [
      'the same event twice',
      [
        candidate('a', { start: at('10:00'), end: at('11:00') }),
        candidate('a', { start: at('10:00'), end: at('11:00') }),
      ],
      'MERGE_TOO_FEW_EVENTS',
    ],
    [
      'different units',
      [
        candidate('a', { start: at('10:00'), end: at('11:00') }),
        candidate(
          'b',
          { start: at('11:00'), end: at('12:00') },
          {
            unitId: 'u2',
          },
        ),
      ],
      'MERGE_DIFFERENT_UNITS',
    ],
    [
      'a gap above the policy',
      [
        candidate('a', { start: at('10:00'), end: at('11:00') }),
        candidate('b', { start: at('11:01'), end: at('12:00') }),
      ],
      'MERGE_GAP_EXCEEDED',
    ],
    [
      'different schedule classes',
      [
        candidate('a', { start: at('10:00'), end: at('11:00') }),
        candidate(
          'b',
          { start: at('11:00'), end: at('12:00') },
          {
            classification: {
              physicalType: 'downtime',
              scheduleClass: 'planned',
            },
          },
        ),
      ],
      'MERGE_INCOMPATIBLE_CLASSIFICATION',
    ],
    [
      'conflicting reason codes',
      [
        candidate('a', { start: at('10:00'), end: at('11:00') }),
        candidate(
          'b',
          { start: at('11:00'), end: at('12:00') },
          {
            coding: { reasonCodeId: 'r2' },
          },
        ),
      ],
      'MERGE_CODING_CONFLICT',
    ],
  ])('rejects %s', (_label, candidates, code) => {
    expect(violationCode(() => planMerge(candidates, POLICY))).toBe(code);
  });

  it('lists every conflicting field', () => {
    expect.assertions(1);
    try {
      planMerge(
        [
          candidate(
            'a',
            { start: at('10:00'), end: at('11:00') },
            {
              coding: { reasonCodeId: 'r1', oeeComponent: 'availability' },
            },
          ),
          candidate(
            'b',
            { start: at('11:00'), end: at('12:00') },
            {
              coding: { reasonCodeId: 'r2', oeeComponent: 'quality' },
            },
          ),
        ],
        POLICY,
      );
    } catch (error) {
      expect((error as OperationViolation).details).toEqual({
        conflicts: [
          { field: 'reasonCodeId', values: ['r1', 'r2'] },
          { field: 'oeeComponent', values: ['availability', 'quality'] },
        ],
      });
    }
  });

  it('accepts different classifications with an explicit override', () => {
    const plan = planMerge(
      [
        candidate('a', { start: at('10:00'), end: at('11:00') }),
        candidate(
          'b',
          { start: at('11:00'), end: at('12:00') },
          {
            classification: {
              physicalType: 'downtime',
              scheduleClass: 'planned',
            },
          },
        ),
      ],
      { ...POLICY, overrideClassification: true },
    );
    expect(plan.ordered[0].classification.scheduleClass).toBe('unplanned');
  });

  it('merging the children of a split restores the parent (property)', () => {
    const next = sequence(99);
    for (let run = 0; run < 100; run++) {
      const start = at('00:00').getTime() + Math.floor(next() * 3_600_000);
      const length = 2 + Math.floor(next() * 36_000_000);
      const parent = { start: new Date(start), end: new Date(start + length) };
      const cut = new Date(start + 1 + Math.floor(next() * (length - 1)));
      const [a, b] = splitInterval(parent, cut, NOW);
      const plan = planMerge([candidate('b', b), candidate('a', a)], POLICY);
      expect(plan.interval).toEqual(parent);
    }
  });
});

describe('validateCloseEnd (DT10)', () => {
  it('accepts an end after the start and not in the future', () => {
    expect(() => validateCloseEnd(at('10:00'), at('11:00'), NOW)).not.toThrow();
  });

  it.each([
    ['equal to the start', at('10:00'), 'CLOSE_END_BEFORE_START'],
    ['before the start', at('09:00'), 'CLOSE_END_BEFORE_START'],
    ['in the future', new Date(NOW.getTime() + 1000), 'CLOSE_END_IN_FUTURE'],
  ])('rejects an end %s', (_label, end, code) => {
    expect(violationCode(() => validateCloseEnd(at('10:00'), end, NOW))).toBe(
      code,
    );
  });
});
