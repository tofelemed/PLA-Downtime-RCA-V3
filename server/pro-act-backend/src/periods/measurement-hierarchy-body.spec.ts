import {
  parseSourceAuthority,
  PolicyBodyError,
  SOURCE_AUTHORITY_DEFAULT,
} from './policy-bodies';

const rank = (overrides: Record<string, unknown>) => ({
  rank: 1,
  sourceClass: 'calibrated_primary',
  source: 'pi_counter',
  signalSourceKey: 'FT-101.TOT',
  boundary: 'reactor_outlet',
  boundaryAdjustment: null,
  ...overrides,
});

const body = (entries: unknown[], extra: Record<string, unknown> = {}) => ({
  ...SOURCE_AUTHORITY_DEFAULT,
  primarySource: 'pi_counter',
  measurementHierarchy: {
    boundary: 'reactor_outlet',
    conditions: ['primary_missing', 'primary_bad_quality'],
    entries,
    ...extra,
  },
});

const valid = [
  rank({}),
  rank({
    rank: 2,
    sourceClass: 'redundant_measurement',
    signalSourceKey: 'FT-102.TOT',
  }),
  rank({
    rank: 3,
    sourceClass: 'reconciled_record',
    source: 'mqtt',
    signalSourceKey: 'PK-1.BAGGED',
    boundary: 'packing',
    boundaryAdjustment: {
      inventoryChangeAccounted: true,
      lagSeconds: 7200,
      evidenceRef: 'silo reconciliation',
    },
  }),
  rank({
    rank: 4,
    sourceClass: 'approved_estimate',
    source: 'manual',
    signalSourceKey: null,
  }),
];

describe('source_authority measurementHierarchy (SME E7)', () => {
  it('a version without a hierarchy parses as before (no key)', () => {
    expect(parseSourceAuthority(SOURCE_AUTHORITY_DEFAULT)).not.toHaveProperty(
      'measurementHierarchy',
    );
  });

  it('parses ranked sources with a bridged boundary and an approved estimate', () => {
    const parsed = parseSourceAuthority(body(valid));
    expect(
      parsed.measurementHierarchy?.entries.map((e) => e.sourceClass),
    ).toEqual([
      'calibrated_primary',
      'redundant_measurement',
      'reconciled_record',
      'approved_estimate',
    ]);
    expect(
      parsed.measurementHierarchy?.entries[2].boundaryAdjustment?.lagSeconds,
    ).toBe(7200);
  });

  it.each([
    [
      'duplicate ranks',
      body([
        rank({}),
        rank({
          rank: 1,
          sourceClass: 'redundant_measurement',
          signalSourceKey: 'B',
        }),
      ]),
    ],
    [
      'classes out of order',
      body([
        rank({}),
        rank({
          rank: 2,
          sourceClass: 'reconciled_record',
          source: 'external_report',
          signalSourceKey: null,
        }),
        rank({
          rank: 3,
          sourceClass: 'redundant_measurement',
          signalSourceKey: 'B',
        }),
      ]),
    ],
    [
      'an estimate that is not the manual source',
      body([rank({}), rank({ rank: 2, sourceClass: 'approved_estimate' })]),
    ],
    [
      'a manual source that is not the estimate',
      body([
        rank({}),
        rank({
          rank: 2,
          sourceClass: 'redundant_measurement',
          source: 'manual',
          signalSourceKey: null,
        }),
      ]),
    ],
    [
      'the same signal twice',
      body([rank({}), rank({ rank: 2, sourceClass: 'redundant_measurement' })]),
    ],
    ['a top rank other than primarySource', body([rank({ source: 'mqtt' })])],
    ['a top rank at another boundary', body([rank({ boundary: 'packing' })])],
    [
      'a lag on a daily report',
      body([
        rank({}),
        rank({
          rank: 2,
          sourceClass: 'reconciled_record',
          source: 'external_report',
          signalSourceKey: null,
          boundary: 'dispatch',
          boundaryAdjustment: {
            inventoryChangeAccounted: true,
            lagSeconds: 60,
            evidenceRef: 'x',
          },
        }),
      ]),
    ],
    [
      'an adjustment at the same boundary',
      body([
        rank({}),
        rank({
          rank: 2,
          sourceClass: 'redundant_measurement',
          signalSourceKey: 'B',
          boundaryAdjustment: {
            inventoryChangeAccounted: true,
            lagSeconds: 0,
            evidenceRef: 'x',
          },
        }),
      ]),
    ],
    [
      'a bridge without evidence',
      body([
        rank({}),
        rank({
          rank: 2,
          sourceClass: 'reconciled_record',
          source: 'mqtt',
          signalSourceKey: 'P',
          boundary: 'packing',
          boundaryAdjustment: {
            inventoryChangeAccounted: true,
            lagSeconds: 0,
            evidenceRef: '',
          },
        }),
      ]),
    ],
    ['no entries', body([])],
    ['an unknown condition', body(valid, { conditions: ['always'] })],
  ])('refuses %s', (_label, candidate) => {
    expect(() => parseSourceAuthority(candidate)).toThrow(PolicyBodyError);
  });
});
