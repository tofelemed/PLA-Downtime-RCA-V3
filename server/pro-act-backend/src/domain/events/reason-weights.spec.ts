import {
  isWeighted,
  normaliseReasonWeights,
  storedReasonWeights,
} from './reason-weights';

const HOUR = { durationSeconds: 3600 };

/** D-T5: weights entered as percent or duration, normalised to 8-place fractions adding up to 1. */
describe('normaliseReasonWeights', () => {
  it('normalises percents, largest first and primary', () => {
    expect(
      normaliseReasonWeights(
        [
          { reasonCodeId: 'r-small', percent: '25' },
          { reasonCodeId: 'r-large', percent: 75 },
        ],
        HOUR,
      ),
    ).toEqual({
      ok: true,
      primary: 'r-large',
      weights: [
        { reasonCodeId: 'r-large', weight: '0.75000000' },
        { reasonCodeId: 'r-small', weight: '0.25000000' },
      ],
    });
  });

  it('puts the 8th-place remainder on the largest reason (Σ = 1 exactly)', () => {
    const result = normaliseReasonWeights(
      [
        { reasonCodeId: 'a', seconds: 1200 },
        { reasonCodeId: 'b', seconds: 1200 },
        { reasonCodeId: 'c', seconds: 1200 },
      ],
      HOUR,
    );
    expect(result).toEqual({
      ok: true,
      primary: 'a',
      weights: [
        { reasonCodeId: 'a', weight: '0.33333334' },
        { reasonCodeId: 'b', weight: '0.33333333' },
        { reasonCodeId: 'c', weight: '0.33333333' },
      ],
    });
  });

  it('lets the named reason code lead among equal largest shares', () => {
    const result = normaliseReasonWeights(
      [
        { reasonCodeId: 'a', percent: 50 },
        { reasonCodeId: 'b', percent: 50 },
      ],
      { ...HOUR, reasonCodeId: 'b' },
    );
    expect(result).toMatchObject({ ok: true, primary: 'b' });
    expect(result.ok && result.weights?.[0].reasonCodeId).toBe('b');
  });

  it('accepts durations within 1 s of the stop and treats one reason as no split', () => {
    expect(
      normaliseReasonWeights(
        [
          { reasonCodeId: 'a', seconds: 2400 },
          { reasonCodeId: 'b', seconds: 1200.5 },
        ],
        HOUR,
      ),
    ).toMatchObject({ ok: true, primary: 'a' });
    expect(
      normaliseReasonWeights([{ reasonCodeId: 'a', percent: 100 }], HOUR),
    ).toEqual({ ok: true, primary: 'a', weights: null });
  });

  it.each([
    [[], HOUR, 'REASON_WEIGHTS_EMPTY'],
    [
      [
        { reasonCodeId: 'a', percent: 50 },
        { reasonCodeId: 'b', seconds: 1800 },
      ],
      HOUR,
      'REASON_WEIGHTS_BASIS',
    ],
    [
      [{ reasonCodeId: 'a', percent: 50, seconds: 1800 }],
      HOUR,
      'REASON_WEIGHTS_BASIS',
    ],
    [
      [
        { reasonCodeId: 'a', percent: 50 },
        { reasonCodeId: 'a', percent: 50 },
      ],
      HOUR,
      'REASON_WEIGHTS_DUPLICATE',
    ],
    [
      [
        { reasonCodeId: 'a', percent: 100 },
        { reasonCodeId: 'b', percent: 0 },
      ],
      HOUR,
      'REASON_WEIGHTS_NOT_POSITIVE',
    ],
    [
      [
        { reasonCodeId: 'a', percent: '60' },
        { reasonCodeId: 'b', percent: '39.99' },
      ],
      HOUR,
      'REASON_WEIGHTS_SUM',
    ],
    [
      [
        { reasonCodeId: 'a', seconds: 1800 },
        { reasonCodeId: 'b', seconds: 1500 },
      ],
      HOUR,
      'REASON_WEIGHTS_SUM',
    ],
    [
      [
        { reasonCodeId: 'a', seconds: 1800 },
        { reasonCodeId: 'b', seconds: 1800 },
      ],
      { durationSeconds: null },
      'REASON_WEIGHTS_OPEN_EVENT',
    ],
    [
      [
        { reasonCodeId: 'a', percent: 70 },
        { reasonCodeId: 'b', percent: 30 },
      ],
      { ...HOUR, reasonCodeId: 'b' },
      'REASON_WEIGHTS_PRIMARY',
    ],
  ])('refuses %j (%j) with %s', (entries, context, code) => {
    expect(normaliseReasonWeights(entries, context)).toMatchObject({
      ok: false,
      error: { code },
    });
  });

  it('allows percent splits of a running stop', () => {
    expect(
      normaliseReasonWeights(
        [
          { reasonCodeId: 'a', percent: 60 },
          { reasonCodeId: 'b', percent: 40 },
        ],
        { durationSeconds: null },
      ),
    ).toMatchObject({ ok: true, primary: 'a' });
  });
});

describe('stored reason weights', () => {
  it('reads a stored split and ignores anything else', () => {
    const stored = [
      { reasonCodeId: 'a', weight: '0.6' },
      { reasonCodeId: 'b', weight: '0.4' },
    ];
    expect(storedReasonWeights(stored)).toEqual(stored);
    expect(storedReasonWeights(null)).toBeNull();
    expect(storedReasonWeights([{ reasonCodeId: 'a', weight: '1' }])).toBe(
      null,
    );
    expect(storedReasonWeights([{ reasonCodeId: 'a' }, 'b'])).toBeNull();
    expect(isWeighted(stored)).toBe(true);
    expect(isWeighted(null)).toBe(false);
  });
});
