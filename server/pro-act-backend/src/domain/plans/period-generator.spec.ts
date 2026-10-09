import { Dec } from '../actuals/decimal';
import { generatePeriods } from './period-generator';
import { GenerationInput, LeafRates, PlanLeaf, SliceInput } from './plan.types';

const H = 3_600_000;
const T0 = Date.parse('2026-11-01T02:30:00Z');

function leaf(index: number, hours = 8, excluded = false): PlanLeaf {
  const start = new Date(T0 + index * 8 * H);
  return {
    shiftInstanceId: `si-${index}`,
    calendarVersionId: 'cal-1',
    localDate: '2026-11-01',
    shiftName: ['A', 'B', 'C'][index % 3],
    start,
    end: new Date(start.getTime() + hours * H),
    isExcluded: excluded,
    exclusionKind: excluded ? 'planned_shutdown' : null,
    offsetChanges: false,
    clipped: false,
  };
}

function slice(overrides: Partial<SliceInput> = {}): SliceInput {
  return {
    key: 's1',
    productId: 'p1',
    stream: 'sequential',
    campaignFrom: null,
    campaignTo: null,
    weight: null,
    target: null,
    ...overrides,
  };
}

/** Rates per hour → per second strings, the way the service resolves them. */
function rates(perHour: number | null, uom = 't', share?: string): LeafRates {
  const perSecond = (value: number) => new Dec(value).div(3600).toFixed();
  return {
    profileId: 'profile-1',
    quantityUom: uom,
    planning:
      perHour === null ? null : { id: 'pr', perSecond: perSecond(perHour) },
    sustained:
      perHour === null ? null : { id: 'sr', perSecond: perSecond(perHour) },
    recipeShare: share ?? null,
    rateChangesInside: false,
  };
}

function input(overrides: Partial<GenerationInput>): GenerationInput {
  const leaves = overrides.leaves ?? [leaf(0), leaf(1), leaf(2)];
  return {
    basis: 'quantity',
    distribution: 'scheduled_capacity',
    headerTarget: '1000',
    slices: [slice()],
    leaves,
    ratesAt: () => rates(100),
    manualTargets: [],
    concurrentProductsEnabled: false,
    window: { start: leaves[0].start, end: leaves[leaves.length - 1].end },
    ...overrides,
  };
}

const targets = (i: GenerationInput) =>
  generatePeriods(i).periods.map((p) => p.target);

describe('generatePeriods: quantity basis', () => {
  it('distributes 1000 by planning capacity [300, 300, 400] exactly', () => {
    const perLeaf = [300 / 8, 300 / 8, 400 / 8];
    const result = generatePeriods(
      input({
        ratesAt: (_, l) => rates(perLeaf[Number(l.shiftInstanceId?.slice(3))]),
      }),
    );
    expect(result.periods.map((p) => p.target)).toEqual(['300', '300', '400']);
    expect(result.headerTarget).toBe('1000');
  });

  it('sums exactly with repeating decimals; remainder on the last eligible leaf; excluded leaf 0', () => {
    const leaves = [leaf(0), leaf(1), leaf(2), leaf(3, 8, true)];
    const result = generatePeriods(input({ leaves }));
    expect(result.periods.map((p) => p.target)).toEqual([
      '333.33333333',
      '333.33333333',
      '333.33333334',
      '0',
    ]);
    expect(result.totals).toEqual([{ quantityUom: 't', target: '1000' }]);
    expect(result.warnings.map((w) => w.code)).toContain('excluded_leaf');
  });

  it('equal distribution uses eligible leaves only', () => {
    const leaves = [leaf(0), leaf(1, 8, true), leaf(2)];
    expect(
      targets(input({ leaves, distribution: 'equal', headerTarget: '10' })),
    ).toEqual(['5', '0', '5']);
  });

  it('explicit weights split the header between campaign slices', () => {
    const slices = [
      slice({ key: 'a', weight: '1', campaignTo: leaf(2).start }),
      slice({
        key: 'b',
        productId: 'p2',
        weight: '3',
        campaignFrom: leaf(2).start,
      }),
    ];
    expect(
      targets(
        input({
          slices,
          distribution: 'explicit_weights',
          headerTarget: '100',
        }),
      ),
    ).toEqual(['12.5', '12.5', '75']);
  });

  it('refuses a positive target with no eligible time (NO_ELIGIBLE_TIME)', () => {
    const leaves = [leaf(0, 8, true)];
    expect(() => generatePeriods(input({ leaves }))).toThrow(
      expect.objectContaining({ code: 'NO_ELIGIBLE_TIME' }),
    );
    expect(() =>
      generatePeriods(input({ ratesAt: () => rates(null) })),
    ).toThrow(expect.objectContaining({ code: 'NO_ELIGIBLE_TIME' }));
  });

  it('per-slice targets when there is no header target', () => {
    const slices = [slice({ target: '90' })];
    expect(targets(input({ slices, headerTarget: null }))).toEqual([
      '30',
      '30',
      '30',
    ]);
    expect(() => generatePeriods(input({ headerTarget: null }))).toThrow(
      expect.objectContaining({ code: 'TARGET_REQUIRED' }),
    );
  });

  it('never adds unlike quantity units under one header target (MIXED_UOM)', () => {
    const slices = [
      slice({ key: 'a', campaignTo: leaf(1).start }),
      slice({ key: 'b', productId: 'p2', campaignFrom: leaf(1).start }),
    ];
    const ratesAt = (s: SliceInput) => rates(100, s.key === 'a' ? 't' : 'm3');
    expect(() => generatePeriods(input({ slices, ratesAt }))).toThrow(
      expect.objectContaining({ code: 'MIXED_UOM' }),
    );
  });
});

describe('generatePeriods: time and manual basis', () => {
  it('time basis: 8 h × 90 t/h with 1 h excluded → 630 t (T28 plan input)', () => {
    const leaves = [
      leaf(0, 7),
      {
        ...leaf(0, 1, true),
        start: new Date(T0 + 7 * H),
        end: new Date(T0 + 8 * H),
      },
    ];
    const result = generatePeriods(
      input({
        basis: 'time',
        headerTarget: null,
        leaves,
        ratesAt: () => rates(90),
      }),
    );
    expect(result.periods.map((p) => p.target)).toEqual(['630', '0']);
    expect(result.headerTarget).toBe('630');
  });

  it('manual targets must add up to the header and sit on eligible leaves', () => {
    const manual = (values: string[]) =>
      values.map((target, i) => ({
        sliceKey: 's1',
        utcStart: leaf(i).start,
        target,
      }));
    const base = { basis: 'manual' as const, headerTarget: '100' };
    expect(
      targets(input({ ...base, manualTargets: manual(['50', '25', '25']) })),
    ).toEqual(['50', '25', '25']);
    expect(() =>
      generatePeriods(input({ ...base, manualTargets: manual(['50', '25']) })),
    ).toThrow(expect.objectContaining({ code: 'TARGET_SUM_MISMATCH' }));
    const excluded = [leaf(0), leaf(1, 8, true), leaf(2)];
    expect(() =>
      generatePeriods(
        input({
          ...base,
          leaves: excluded,
          manualTargets: manual(['50', '25', '25']),
        }),
      ),
    ).toThrow(expect.objectContaining({ code: 'NO_ELIGIBLE_TIME' }));
  });
});

describe('generatePeriods: campaigns and concurrent products (D14)', () => {
  it('sequential campaigns take the leaves that start inside them; overlap is refused', () => {
    const slices = [
      slice({ key: 'a', campaignTo: leaf(2).start, target: '20' }),
      slice({
        key: 'b',
        productId: 'p2',
        campaignFrom: leaf(2).start,
        target: '10',
      }),
    ];
    const result = generatePeriods(input({ slices, headerTarget: null }));
    expect(result.periods.map((p) => [p.sliceKey, p.target])).toEqual([
      ['a', '10'],
      ['a', '10'],
      ['b', '10'],
    ]);
    const overlapping = [
      slices[0],
      { ...slices[1], campaignFrom: leaf(1).start },
    ];
    expect(() =>
      generatePeriods(input({ slices: overlapping, headerTarget: null })),
    ).toThrow(expect.objectContaining({ code: 'CAMPAIGN_OVERLAP' }));
  });

  it('concurrent streams need the CONCURRENT_PRODUCTS flag and one stream kind', () => {
    const slices = [slice({ stream: 'independent', target: '1' })];
    expect(() =>
      generatePeriods(input({ slices, headerTarget: null })),
    ).toThrow(
      expect.objectContaining({ code: 'CONCURRENT_PRODUCTS_DISABLED' }),
    );
    const mixed = [
      slice({ key: 'a' }),
      slice({ key: 'b', productId: 'p2', stream: 'shared' }),
    ];
    expect(() =>
      generatePeriods(
        input({ slices: mixed, concurrentProductsEnabled: true }),
      ),
    ).toThrow(expect.objectContaining({ code: 'MIXED_STREAMS' }));
  });

  it('independent streams each use the full scheduled time at their own rate', () => {
    const slices = [
      slice({ key: 'a', stream: 'independent' }),
      slice({ key: 'b', productId: 'p2', stream: 'independent' }),
    ];
    const result = generatePeriods(
      input({
        slices,
        basis: 'time',
        headerTarget: null,
        leaves: [leaf(0)],
        concurrentProductsEnabled: true,
      }),
    );
    expect(result.periods.map((p) => [p.sliceKey, p.target])).toEqual([
      ['a', '800'],
      ['b', '800'],
    ]);
  });
});
