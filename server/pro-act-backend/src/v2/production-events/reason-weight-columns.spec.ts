import { UnprocessableEntityException } from '@nestjs/common';
import {
  bulkReasonWeights,
  patchReasonWeights,
  weightedReasonColumns,
} from './reason-weight-columns';

const STOP = {
  reasonCodeId: 'r1',
  reasonWeights: [
    { reasonCodeId: 'r1', weight: '0.60000000' },
    { reasonCodeId: 'r2', weight: '0.40000000' },
  ],
  startTime: new Date('2026-10-08T10:00:00Z'),
  endTime: new Date('2026-10-08T11:00:00Z'),
};

const codeOf = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (error) {
    if (error instanceof UnprocessableEntityException) {
      return (error.getResponse() as { code: string }).code;
    }
    throw error;
  }
  return null;
};

/** D-T5 columns of PATCH and bulk code: normalised weights, primary reason, removal rules, 422s. */
describe('weightedReasonColumns', () => {
  it('normalises seconds of the closed stop and sets the primary reason', () => {
    expect(
      weightedReasonColumns(STOP, {
        reasonWeights: [
          { reasonCodeId: 'r3', seconds: 900 },
          { reasonCodeId: 'r4', seconds: 2700 },
        ],
      }),
    ).toEqual({
      reasonCodeId: 'r4',
      reasonWeights: [
        { reasonCodeId: 'r4', weight: '0.75000000' },
        { reasonCodeId: 'r3', weight: '0.25000000' },
      ],
    });
  });

  it('measures seconds against a new end of a manual event', () => {
    const result = weightedReasonColumns(
      STOP,
      {
        reasonWeights: [
          { reasonCodeId: 'r3', seconds: 3600 },
          { reasonCodeId: 'r4', seconds: 3600 },
        ],
      },
      new Date('2026-10-08T12:00:00Z'),
    );
    expect(result.reasonCodeId).toBe('r3');
  });

  it('removes the split on null, on another reason code and when the reason is cleared', () => {
    expect(weightedReasonColumns(STOP, { reasonWeights: null })).toEqual({
      reasonWeights: null,
    });
    expect(weightedReasonColumns(STOP, { reasonCodeId: 'r9' })).toEqual({
      reasonWeights: null,
    });
    expect(weightedReasonColumns(STOP, { reasonCodeId: null })).toEqual({
      reasonWeights: null,
    });
    expect(weightedReasonColumns(STOP, { reasonCodeId: 'r1' })).toEqual({});
    expect(weightedReasonColumns(STOP, {})).toEqual({});
  });

  it('answers 422 with the broken rule', () => {
    const percent = (a: string, b: string) => [
      { reasonCodeId: 'r1', percent: a },
      { reasonCodeId: 'r2', percent: b },
    ];
    expect(
      codeOf(() =>
        weightedReasonColumns(STOP, { reasonWeights: percent('60', '30') }),
      ),
    ).toBe('REASON_WEIGHTS_SUM');
    expect(
      codeOf(() =>
        weightedReasonColumns(STOP, {
          reasonCodeId: null,
          reasonWeights: percent('60', '40'),
        }),
      ),
    ).toBe('REASON_WEIGHTS_PRIMARY');
    expect(
      codeOf(() =>
        weightedReasonColumns(STOP, {
          reasonCodeId: 'r2',
          reasonWeights: percent('60', '40'),
        }),
      ),
    ).toBe('REASON_WEIGHTS_PRIMARY');
  });
});

describe('bulkReasonWeights', () => {
  it('splits by percent and refuses seconds', () => {
    expect(
      bulkReasonWeights(
        [
          { reasonCodeId: 'r1', percent: '30' },
          { reasonCodeId: 'r2', percent: '70' },
        ],
        undefined,
      ).reasonCodeId,
    ).toBe('r2');
    expect(
      codeOf(() =>
        bulkReasonWeights(
          [
            { reasonCodeId: 'r1', seconds: 10 },
            { reasonCodeId: 'r2', seconds: 10 },
          ],
          undefined,
        ),
      ),
    ).toBe('REASON_WEIGHTS_BASIS');
  });
});

describe('patchReasonWeights', () => {
  it('checks every reason of the split against the tenant library', async () => {
    const assertReasonCodesOwned = jest.fn().mockResolvedValue(undefined);
    await patchReasonWeights({ assertReasonCodesOwned }, 'tenant-1', {
      existing: STOP,
      dto: {
        reasonWeights: [
          { reasonCodeId: 'r3', percent: '50' },
          { reasonCodeId: 'r4', percent: '50' },
        ],
      },
    });
    expect(assertReasonCodesOwned).toHaveBeenCalledWith('tenant-1', [
      'r3',
      'r4',
    ]);
  });
});
