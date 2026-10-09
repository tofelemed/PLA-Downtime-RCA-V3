import * as fs from 'fs';
import * as path from 'path';
import { Dec } from '../../src/domain/actuals/decimal';
import { generatePeriods } from '../../src/domain/plans/period-generator';
import {
  GenerationInput,
  LeafRates,
  PlanLeaf,
  SliceInput,
} from '../../src/domain/plans/plan.types';

/**
 * Plan 2.3 acceptance: T43 (concurrent products on a shared-capacity recipe) and the plan-ledger input of
 * T28 (8 h × planning rate 90 t/h with 1 h schedule exclusion → target 630 t), computed by the period
 * generator. The plan ledger itself is 2.5's; here the targets must be exact.
 */
interface Fixture {
  id: string;
  inputs?: Record<string, string>;
  expected?: { plan?: Record<string, unknown> };
}

function fixture(id: string): Fixture {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, `${id}.json`), 'utf8'),
  ) as Fixture;
}

const H = 3_600_000;
const START = Date.parse('2026-11-02T02:30:00Z'); // 06:00 Asia/Tehran (D03)

function leaf(fromHour: number, hours: number, excluded = false): PlanLeaf {
  const start = new Date(START + fromHour * H);
  return {
    shiftInstanceId: null,
    calendarVersionId: null,
    localDate: '2026-11-02',
    shiftName: 'A',
    start,
    end: new Date(start.getTime() + hours * H),
    isExcluded: excluded,
    exclusionKind: excluded ? 'planned_shutdown' : null,
    offsetChanges: false,
    clipped: false,
  };
}

function rates(perHour: string, uom: string, share: string | null): LeafRates {
  const perSecond = new Dec(perHour).div(3600).toFixed();
  return {
    profileId: `profile-${uom}`,
    quantityUom: uom,
    planning: { id: `planning-${uom}`, perSecond },
    sustained: { id: `sustained-${uom}`, perSecond },
    recipeShare: share,
    rateChangesInside: false,
  };
}

function base(overrides: Partial<GenerationInput>): GenerationInput {
  const leaves = overrides.leaves ?? [leaf(0, 8)];
  return {
    basis: 'time',
    distribution: 'scheduled_capacity',
    headerTarget: null,
    slices: [],
    leaves,
    ratesAt: () => rates('1', 't', null),
    manualTargets: [],
    concurrentProductsEnabled: true,
    window: { start: leaves[0].start, end: leaves[leaves.length - 1].end },
    ...overrides,
  };
}

const shared = (key: string, productId: string): SliceInput => ({
  key,
  productId,
  stream: 'shared',
  campaignFrom: null,
  campaignTo: null,
  weight: null,
  target: null,
});

describe('T28 plan-ledger input (plan 2.3)', () => {
  const { inputs, expected } = fixture('T28');
  it('time basis: calendar hours × planning rate minus the excluded hour = planTargetQty', () => {
    const hours = Number(inputs?.calendarHours);
    const excluded = Number(inputs?.excludedHours);
    const leaves = [
      leaf(0, hours - excluded),
      leaf(hours - excluded, excluded, true),
    ];
    const result = generatePeriods(
      base({
        leaves,
        concurrentProductsEnabled: false,
        slices: [{ ...shared('s', 'p'), stream: 'sequential' }],
        ratesAt: () => rates(String(inputs?.planningRatePerHour), 't', null),
      }),
    );
    expect(result.headerTarget).toBe(inputs?.planTargetQty);
    expect(result.headerTarget).toBe(expected?.plan?.targetQty);
    expect(result.periods.map((p) => p.target)).toEqual(['630', '0']);
  });
});

describe('T43 concurrent products on a shared-capacity recipe', () => {
  expect(fixture('T43').id).toBe('T43');
  const slices = [shared('pe', 'product-pe'), shared('pp', 'product-pp')];

  it('refuses an infeasible combined rate (shares above the shared capacity)', () => {
    const ratesAt = (slice: SliceInput) =>
      slice.key === 'pe' ? rates('100', 't', '0.7') : rates('40', 'm3', '0.5');
    expect(() => generatePeriods(base({ slices, ratesAt }))).toThrow(
      expect.objectContaining({ code: 'INFEASIBLE_PRODUCT_MIX' }),
    );
  });

  it('refuses a slice the recipe gives no share', () => {
    const ratesAt = (slice: SliceInput) =>
      slice.key === 'pe' ? rates('100', 't', '0.6') : rates('40', 'm3', null);
    expect(() => generatePeriods(base({ slices, ratesAt }))).toThrow(
      expect.objectContaining({ code: 'INFEASIBLE_PRODUCT_MIX' }),
    );
  });

  it('feasible recipe: separate slice targets, shared time split, unlike units not totalled', () => {
    const ratesAt = (slice: SliceInput) =>
      slice.key === 'pe' ? rates('100', 't', '0.6') : rates('40', 'm3', '0.4');
    const result = generatePeriods(base({ slices, ratesAt }));
    // 8 h shared: 0.6 × 8 h × 100 t/h and 0.4 × 8 h × 40 m3/h — 8 h of time, not 16
    expect(result.periods.map((p) => [p.sliceKey, p.target])).toEqual([
      ['pe', '480'],
      ['pp', '128'],
    ]);
    expect(result.totals).toEqual([
      { quantityUom: 't', target: '480' },
      { quantityUom: 'm3', target: '128' },
    ]);
    expect(result.headerTarget).toBeNull();
  });

  it('quantity basis per slice is distributed over that slice’s own leaves', () => {
    const ratesAt = (slice: SliceInput) =>
      slice.key === 'pe' ? rates('100', 't', '0.6') : rates('40', 'm3', '0.4');
    const result = generatePeriods(
      base({
        basis: 'quantity',
        leaves: [leaf(0, 8), leaf(8, 8)],
        slices: [
          { ...slices[0], target: '900' },
          { ...slices[1], target: '200' },
        ],
        ratesAt,
      }),
    );
    expect(result.periods.map((p) => [p.sliceKey, p.target])).toEqual([
      ['pe', '450'],
      ['pp', '100'],
      ['pe', '450'],
      ['pp', '100'],
    ]);
  });
});
