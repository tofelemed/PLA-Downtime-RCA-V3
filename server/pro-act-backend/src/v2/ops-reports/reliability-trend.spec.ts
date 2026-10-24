import { UnprocessableEntityException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Dec, toDec } from '../../domain/actuals/decimal';
import { GroupTerms } from '../../domain/kpi/aggregate';
import { KpiMetric } from '../../domain/kpi/kpi.types';
import {
  GroupedTerms,
  KpiGroupSpec,
  kpiGroups,
  TIME_GROUPS,
} from '../reports/report-sql';
import { ReportScope } from '../reports/report-scope';
import {
  fallingMtbf,
  reliabilityTrend,
  TREND_ASSET_LIMIT,
} from './reliability-trend';

jest.mock('../reports/report-sql', () => {
  const actual: object = jest.requireActual('../reports/report-sql');
  return {
    ...actual,
    kpiGroups: jest.fn(),
    periodStats: jest.fn(() =>
      Promise.resolve({ periods: 1, withRun: 1, approved: 1, runIds: ['r'] }),
    ),
    policyVersions: jest.fn(() => Promise.resolve([])),
  };
});

const HOUR = 3600;
const SEP = '2026-09';
const OCT = '2026-10';

/** One stored row: a unit's exposure / failures, or an asset's own failures, in a plant month. */
interface Fact {
  month: string;
  unitId: string;
  assetId?: string;
  exposure?: number;
  failures: number;
}

const terms = (numerator: Dec | null, denominator: Dec): GroupTerms => ({
  numerator,
  denominator,
  minValue: null,
  rows: 1,
  complete: 1,
  provisionalRows: 0,
  policies: 1,
  reasons: [],
});

/** Stands in for the SQL: Σ numerator and Σ denominator of the facts per group key. */
function fakeGroups(facts: Fact[], spec: KpiGroupSpec): GroupedTerms {
  const asset = spec.level === 'asset';
  const out: GroupedTerms = new Map();
  for (const f of facts.filter((x) => Boolean(x.assetId) === asset)) {
    const id = asset ? f.assetId : f.unitId;
    const key =
      spec.groupSql === TIME_GROUPS.month ? f.month : `${f.month}|${id}`;
    const byMetric = out.get(key) ?? new Map<KpiMetric, GroupTerms>();
    const prev = byMetric.get('mtbf');
    const num = toDec(f.exposure ?? null);
    byMetric.set(
      'mtbf',
      prev
        ? terms(
            prev.numerator && num
              ? prev.numerator.plus(num)
              : (prev.numerator ?? num),
            (prev.denominator ?? new Dec(0)).plus(f.failures),
          )
        : terms(num, new Dec(f.failures)),
    );
    out.set(key, byMetric);
  }
  return out;
}

const ASSETS = [
  { id: 'a-x', unit_id: 'u-a', name: 'Extruder' },
  { id: 'a-y', unit_id: 'u-a', name: 'Pump' },
  { id: 'a-z', unit_id: 'u-b', name: 'Gearbox' },
];

function manager(assets = ASSETS): EntityManager {
  const query = jest.fn((_sql: string, params: unknown[]) => {
    const ids = params[1] as string[];
    return Promise.resolve(assets.filter((a) => ids.includes(a.id)));
  });
  return { query } as unknown as EntityManager;
}

const scope: ReportScope = {
  tenantId: 't',
  unitIds: ['u-a', 'u-b'],
  restricted: null,
  from: new Date('2026-09-01T00:00:00Z'),
  to: new Date('2026-11-01T00:00:00Z'),
  approvedOnly: false,
  weekStart: 'saturday',
};

function world(facts: Fact[]): void {
  jest
    .mocked(kpiGroups)
    .mockImplementation((_m, _s, spec) =>
      Promise.resolve(fakeGroups(facts, spec)),
    );
}

const UNITS: Fact[] = [
  { month: SEP, unitId: 'u-a', exposure: 100 * HOUR, failures: 2 },
  { month: SEP, unitId: 'u-b', exposure: 300 * HOUR, failures: 2 },
];

describe('reliability trend (R6)', () => {
  beforeEach(() => jest.mocked(kpiGroups).mockReset());

  it('flags MTBF that fell in each of the last three months with a value', () => {
    expect(fallingMtbf(['500', '400', '300', '200'])).toBe(true);
    expect(fallingMtbf(['500', '400', null, '300', '200'])).toBe(true);
  });

  it('does not flag a rise, a flat month or too short a history', () => {
    expect(fallingMtbf(['500', '400', '450', '200'])).toBe(false);
    expect(fallingMtbf(['400', '400', '300', '200'])).toBe(false);
    expect(fallingMtbf(['400', '300', '200'])).toBe(false);
    expect(fallingMtbf([null, null])).toBe(false);
  });

  it('total sums the terms of every unit per month', async () => {
    world(UNITS);
    const { data } = await reliabilityTrend(manager(), scope);
    expect(data.units.map((u) => u.months[0].row.mtbf.value)).toEqual([
      '180000',
      '540000',
    ]);
    // 400 h ÷ 4 failures, never the mean of 50 h and 150 h
    expect(data.total.months[0].row.mtbf.value).toBe('360000');
    expect(data.total.months[0].row.exposureSeconds).toBe('1440000');
    expect(data.total.months[0].row.failures).toBe('4');
    expect(data.total.months[0].row).not.toHaveProperty('unitId');
  });

  it('total follows the asset filter', async () => {
    world([
      ...UNITS,
      { month: SEP, unitId: 'u-a', assetId: 'a-x', failures: 1 },
      { month: SEP, unitId: 'u-b', assetId: 'a-z', failures: 2 },
    ]);
    const { data } = await reliabilityTrend(manager(), scope, ['a-x']);
    const x = data.assets.find((a) => a.assetId === 'a-x');
    const rows = x?.months.map(
      ({ row: { unitId, assetId, label, ...row } }) => {
        expect([unitId, assetId, label]).toEqual(['u-a', 'a-x', 'Extruder']);
        return row;
      },
    );
    expect(data.total.months.map((m) => m.row)).toEqual(rows);
    expect(data.total.months[0].row.mtbf.value).toBe('360000');
    expect(data.total.fallingMtbf).toBe(x?.fallingMtbf);
    expect(jest.mocked(kpiGroups)).toHaveBeenCalledTimes(2);
  });

  it('counts a unit’s exposure once when several of its assets are filtered', async () => {
    world([
      ...UNITS,
      { month: SEP, unitId: 'u-a', assetId: 'a-x', failures: 1 },
      { month: SEP, unitId: 'u-a', assetId: 'a-y', failures: 1 },
      { month: SEP, unitId: 'u-b', assetId: 'a-z', failures: 2 },
    ]);
    const { data } = await reliabilityTrend(manager(), scope, [
      'a-x',
      'a-y',
      'a-z',
    ]);
    // (100 h of unit A once + 300 h of unit B) ÷ (1 + 1 + 2) failures
    expect(data.total.months[0].row.exposureSeconds).toBe('1440000');
    expect(data.total.months[0].row.failures).toBe('4');
    expect(data.total.months[0].row.mtbf.value).toBe('360000');
  });

  it('a filtered asset outside the top 30 is still listed', async () => {
    const many = Array.from({ length: TREND_ASSET_LIMIT + 1 }, (_, i) => ({
      id: `a-${String(i).padStart(2, '0')}`,
      unit_id: 'u-a',
      name: `Asset ${i}`,
    }));
    const quiet = { id: 'a-quiet', unit_id: 'u-a', name: 'Quiet' };
    world([
      ...UNITS,
      ...many.map((a) => ({
        month: SEP,
        unitId: 'u-a',
        assetId: a.id,
        failures: 5,
      })),
    ]);
    const { data } = await reliabilityTrend(manager([...many, quiet]), scope, [
      'a-quiet',
    ]);
    expect(data.assets).toHaveLength(TREND_ASSET_LIMIT + 1);
    expect(data.assets.map((a) => a.assetId)).toContain('a-quiet');
  });

  it('total months with no terms carry null values', async () => {
    world(UNITS);
    jest.mocked(kpiGroups).mockImplementation((_m, _s, spec) => {
      const units = fakeGroups(
        [
          ...UNITS,
          { month: OCT, unitId: 'u-a', exposure: 10 * HOUR, failures: 1 },
        ],
        spec,
      );
      if (spec.groupSql === TIME_GROUPS.month) units.delete(OCT);
      return Promise.resolve(units);
    });
    const { data } = await reliabilityTrend(manager(), scope);
    expect(data.months).toEqual([SEP, OCT]);
    expect(data.total.months.map((m) => m.month)).toEqual([SEP, OCT]);
    expect(data.total.months[1].row.mtbf.value).toBeNull();
    expect(data.total.months[1].row.exposureSeconds).toBeNull();
  });

  it('rejects an asset outside the caller’s units (422 INVALID_REFERENCE)', async () => {
    world(UNITS);
    const foreign = [{ id: 'a-f', unit_id: 'u-other', name: 'Other' }];
    await expect(
      reliabilityTrend(manager(foreign), scope, ['a-f']),
    ).rejects.toThrow(UnprocessableEntityException);
  });
});
