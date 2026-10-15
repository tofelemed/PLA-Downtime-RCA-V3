import { restatementDelta, ReviewedFigures } from './restatement-delta';

const slice = (over: Partial<ReviewedFigures['slices'][number]> = {}) => ({
  uom: 't',
  target: '100',
  actual: '100',
  gap: '0',
  attributed: '0',
  toleranceAdjustment: '0',
  residual: '0',
  ...over,
});

describe('restatement delta (SME R5)', () => {
  it('worked example: 5 t of good reclassified as off-grade — good −5, quality +5, gross unchanged', () => {
    const before: ReviewedFigures = {
      slices: [slice()],
      actuals: [{ uom: 't', gross: '100', good: '100', reject: '0' }],
      lines: [],
    };
    const after: ReviewedFigures = {
      slices: [slice({ actual: '95', gap: '5', attributed: '5' })],
      actuals: [{ uom: 't', gross: '100', good: '95', reject: '5' }],
      lines: [
        { kind: 'quality', reasonCodeId: 'offgrade', uom: 't', quantity: '5' },
      ],
    };
    const delta = restatementDelta(before, after);
    expect(delta.actuals[0].figures).toMatchObject({
      gross: { old: '100', new: '100', delta: '0' },
      good: { old: '100', new: '95', delta: '-5' },
      reject: { delta: '5' },
    });
    expect(delta.totals[0].figures.actual).toEqual({
      old: '100',
      new: '95',
      delta: '-5',
    });
    expect(delta.lines).toEqual([
      {
        kind: 'quality',
        reasonCodeId: 'offgrade',
        uom: 't',
        old: '0',
        new: '5',
        delta: '5',
      },
    ]);
  });

  it('sums per unit of measure, never across units; unchanged lines are left out', () => {
    const lines = [
      { kind: 'availability', reasonCodeId: 'r1', uom: 't', quantity: '10' },
    ];
    const delta = restatementDelta(
      {
        slices: [slice(), slice({ uom: 'm3', target: '7' })],
        actuals: [],
        lines,
      },
      {
        slices: [slice({ target: '120' }), slice({ uom: 'm3', target: '7' })],
        actuals: [],
        lines,
      },
    );
    expect(delta.totals.map((t) => [t.uom, t.figures.target.delta])).toEqual([
      ['m3', '0'],
      ['t', '20'],
    ]);
    expect(delta.lines).toEqual([]);
  });

  it('an unknown figure on either side has no delta (never a fabricated 0)', () => {
    const delta = restatementDelta(
      { slices: [slice({ actual: null })], actuals: [], lines: [] },
      { slices: [slice()], actuals: [], lines: [] },
    );
    expect(delta.totals[0].figures.actual).toEqual({
      old: null,
      new: '100',
      delta: null,
    });
  });
});
