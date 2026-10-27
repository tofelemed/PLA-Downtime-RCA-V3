import {
  isWeighted,
  lossWeightTotal,
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

/** Declared mode: a production loss is split across reasons by tonnes (sum = the event quantity). */
describe('normaliseReasonWeights by quantity', () => {
  const LOSS = { durationSeconds: 86_400, quantity: 7.5 };

  it('normalises tonnes to fractions, largest first and primary', () => {
    expect(
      normaliseReasonWeights(
        [
          { reasonCodeId: 'r-small', quantity: '1.875' },
          { reasonCodeId: 'r-large', quantity: 5.625 },
        ],
        LOSS,
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

  it('refuses tonnes that do not add up to the event quantity', () => {
    const result = normaliseReasonWeights(
      [
        { reasonCodeId: 'a', quantity: 4 },
        { reasonCodeId: 'b', quantity: 3 },
      ],
      LOSS,
    );
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'REASON_WEIGHTS_SUM',
        message: "The tonnes add up to 7 t, not the event's 7.5 t",
      },
    });
  });

  it('accepts a total within max(0.001, quantity x 1e-6)', () => {
    const near = (total: number, quantity: number) =>
      normaliseReasonWeights(
        [
          { reasonCodeId: 'a', quantity: total / 2 },
          { reasonCodeId: 'b', quantity: total / 2 },
        ],
        { durationSeconds: null, quantity },
      ).ok;
    expect(near(7.5005, 7.5)).toBe(true);
    expect(near(7.5015, 7.5)).toBe(false);
    expect(near(10_000_005, 10_000_000)).toBe(true);
    expect(near(10_000_015, 10_000_000)).toBe(false);
  });

  it('keeps percent working for a production loss', () => {
    const result = normaliseReasonWeights(
      [
        { reasonCodeId: 'a', percent: 60 },
        { reasonCodeId: 'b', percent: 40 },
      ],
      LOSS,
    );
    expect(result.ok).toBe(true);
  });

  it('refuses seconds for a production loss, and tonnes for a stop', () => {
    const seconds = normaliseReasonWeights(
      [{ reasonCodeId: 'a', seconds: 86_400 }],
      LOSS,
    );
    expect(seconds).toMatchObject({
      ok: false,
      error: { code: 'REASON_WEIGHTS_BASIS' },
    });
    const tonnes = normaliseReasonWeights(
      [{ reasonCodeId: 'a', quantity: 1 }],
      HOUR,
    );
    expect(tonnes).toMatchObject({
      ok: false,
      error: { code: 'REASON_WEIGHTS_BASIS' },
    });
  });

  it('refuses an entry that states two bases', () => {
    expect(
      normaliseReasonWeights(
        [{ reasonCodeId: 'a', percent: 100, quantity: 7.5 }],
        LOSS,
      ),
    ).toMatchObject({ ok: false, error: { code: 'REASON_WEIGHTS_BASIS' } });
  });
});

/** Task 13: a production loss split with recovery shares — Σ loss − Σ recovery = the shortfall. */
describe('normaliseReasonWeights with recovery shares', () => {
  const SHORTFALL = { durationSeconds: null, quantity: 32 };
  const split = [
    { reasonCodeId: 'avail', quantity: '23' },
    { reasonCodeId: 'perf', quantity: '11' },
    { reasonCodeId: 'qual', quantity: '6' },
    { reasonCodeId: 'recov', quantity: '8', recovery: true },
  ];

  it('normalises 23 + 11 + 6 − 8 = 32 against the net shortfall, recovery last', () => {
    expect(normaliseReasonWeights(split, SHORTFALL)).toEqual({
      ok: true,
      primary: 'avail',
      weights: [
        { reasonCodeId: 'avail', weight: '0.71875000' },
        { reasonCodeId: 'perf', weight: '0.34375000' },
        { reasonCodeId: 'qual', weight: '0.18750000' },
        { reasonCodeId: 'recov', weight: '0.25000000', recovery: true },
      ],
    });
  });

  it('gives the gross loss weight Σ loss = 1.25 (40 / 32)', () => {
    const result = normaliseReasonWeights(split, SHORTFALL);
    const weights = result.ok ? result.weights : null;
    expect(lossWeightTotal(weights).toFixed()).toBe('1.25');
    expect(lossWeightTotal(null).toFixed()).toBe('1');
  });

  it('refuses tonnes whose net is not the shortfall, naming the recovery', () => {
    expect(
      normaliseReasonWeights(
        [
          { reasonCodeId: 'a', quantity: '40' },
          { reasonCodeId: 'b', quantity: '6', recovery: true },
        ],
        SHORTFALL,
      ),
    ).toEqual({
      ok: false,
      error: {
        code: 'REASON_WEIGHTS_SUM',
        message:
          "The loss tonnes less the recovery tonnes add up to 34 t, not the event's 32 t",
      },
    });
  });

  it('accepts percents with loss − recovery = 100', () => {
    const result = normaliseReasonWeights(
      [
        { reasonCodeId: 'a', percent: '125' },
        { reasonCodeId: 'b', percent: '25', recovery: true },
      ],
      SHORTFALL,
    );
    expect(result).toMatchObject({
      ok: true,
      primary: 'a',
      weights: [
        { reasonCodeId: 'a', weight: '1.25000000' },
        { reasonCodeId: 'b', weight: '0.25000000', recovery: true },
      ],
    });
  });

  it('a larger recovery never becomes the primary reason', () => {
    const result = normaliseReasonWeights(
      [
        { reasonCodeId: 'a', quantity: '30' },
        { reasonCodeId: 'b', quantity: '12' },
        { reasonCodeId: 'r', quantity: '10', recovery: true },
      ],
      SHORTFALL,
    );
    expect(result).toMatchObject({ ok: true, primary: 'a' });
    expect(
      normaliseReasonWeights(
        [
          { reasonCodeId: 'a', quantity: '30' },
          { reasonCodeId: 'r', quantity: '30', recovery: true },
          { reasonCodeId: 'b', quantity: '32' },
        ],
        { ...SHORTFALL, reasonCodeId: 'r' },
      ),
    ).toMatchObject({ ok: false, error: { code: 'REASON_WEIGHTS_PRIMARY' } });
  });

  it('refuses a recovery on a stop and a split of recoveries only', () => {
    expect(
      normaliseReasonWeights(
        [
          { reasonCodeId: 'a', percent: 60 },
          { reasonCodeId: 'b', percent: 40, recovery: true },
        ],
        HOUR,
      ),
    ).toMatchObject({ ok: false, error: { code: 'REASON_WEIGHTS_RECOVERY' } });
    expect(
      normaliseReasonWeights(
        [{ reasonCodeId: 'a', quantity: '32', recovery: true }],
        SHORTFALL,
      ),
    ).toMatchObject({ ok: false, error: { code: 'REASON_WEIGHTS_RECOVERY' } });
  });

  it('keeps the recovery mark when reading stored weights back', () => {
    expect(
      storedReasonWeights([
        { reasonCodeId: 'a', weight: '1.25000000' },
        { reasonCodeId: 'b', weight: '0.25000000', recovery: true },
      ]),
    ).toEqual([
      { reasonCodeId: 'a', weight: '1.25000000' },
      { reasonCodeId: 'b', weight: '0.25000000', recovery: true },
    ]);
    expect(
      storedReasonWeights([
        { reasonCodeId: 'a', weight: '0.5' },
        { reasonCodeId: 'b', weight: '0.5', recovery: 'yes' },
      ]),
    ).toBeNull();
  });
});
