import {
  ApiError,
  DAY1,
  DAY2,
  DAY3,
  DAY3_A_END,
  PlanWorld,
  PreviewBody,
} from './support/plan-world';

const EIGHT_HOURS_LATER = '2027-03-01T10:30:00Z';

/**
 * Plan 2.3 generation rules on stored shift instances and approved rates: the T28 plan input (time basis,
 * 8 h × 90 t/h with a 1 h schedule exclusion → 630 t), no target on a schedule without eligible time,
 * sequential campaigns (D14) and T43 concurrent products on a shared-capacity joint recipe behind the
 * CONCURRENT_PRODUCTS flag (infeasible → 422; feasible → separate slice targets, unlike units not added).
 */
describe('plan period generation: exclusions, campaigns, concurrent products (plan 2.3)', () => {
  const env = new PlanWorld();
  const flag = process.env.CONCURRENT_PRODUCTS;

  beforeAll(() => env.start());
  afterAll(async () => {
    process.env.CONCURRENT_PRODUCTS = flag;
    await env.stop();
  });

  async function preview(body: Record<string, unknown>, expected = 200) {
    const plan = await env.createPlan(body);
    return env
      .post(`production-plans/${plan.id}/generate-periods`, {
        version: 1,
        preview: true,
      })
      .expect(expected);
  }

  it('T28 input: time basis over shift A with a 1 h exclusion gives 630 t', async () => {
    const response = await preview({
      basis: 'time',
      headerTarget: null,
      validFrom: DAY3,
      validTo: DAY3_A_END,
    });
    const body = response.body as PreviewBody;
    expect(
      body.periods.map((p) => [p.isExcluded, p.scheduledSeconds, p.target]),
    ).toEqual([
      [true, 0, '0'],
      [false, 25200, '630'],
    ]);
    expect(body.headerTarget).toBe('630');
    expect(body.warnings.map((w) => w.code)).toContain('excluded_leaf');
  });

  it('refuses a positive target with no eligible time (NO_ELIGIBLE_TIME)', async () => {
    const response = await preview(
      { headerTarget: '10', validFrom: DAY3, validTo: '2027-03-03T03:30:00Z' },
      422,
    );
    expect((response.body as ApiError).code).toBe('NO_ELIGIBLE_TIME');
  });

  it('equal distribution skips the excluded leaf', async () => {
    const plan = await env.createPlan({
      headerTarget: '100',
      distribution: 'equal',
      validFrom: DAY3,
      validTo: DAY3_A_END,
    });
    await env.generate(plan.id, 1);
    expect((await env.periods(plan.id, 1)).map((p) => p.target)).toEqual([
      '0',
      '100',
    ]);
  });

  it('sequential campaigns split the leaves; overlapping campaigns are refused', async () => {
    const slices = [
      { productId: env.products.p1, campaignTo: EIGHT_HOURS_LATER },
      { productId: env.products.p2, campaignFrom: EIGHT_HOURS_LATER },
    ];
    const ok = await preview({ basis: 'time', headerTarget: null, slices });
    const body = ok.body as PreviewBody;
    expect(body.periods.map((p) => [p.shiftName, p.target])).toEqual([
      ['A', '720'],
      ['B', '720'],
      ['C', '720'],
    ]);
    expect(new Set(body.periods.map((p) => p.sliceId)).size).toBe(2);
    const overlapping = await preview(
      {
        slices: [
          { productId: env.products.p1, campaignTo: '2027-03-01T14:30:00Z' },
          { productId: env.products.p2, campaignFrom: EIGHT_HOURS_LATER },
        ],
      },
      422,
    );
    expect((overlapping.body as ApiError).code).toBe('CAMPAIGN_OVERLAP');
  });

  it('concurrent streams are refused while CONCURRENT_PRODUCTS is off (D14)', async () => {
    delete process.env.CONCURRENT_PRODUCTS;
    const response = await preview(
      {
        unitId: env.world.unitA2,
        basis: 'time',
        headerTarget: null,
        slices: [
          { productId: env.products.p1, stream: 'independent' },
          { productId: env.products.p2, stream: 'independent' },
        ],
      },
      422,
    );
    expect((response.body as ApiError).code).toBe(
      'CONCURRENT_PRODUCTS_DISABLED',
    );
  });

  describe('T43 shared-capacity recipe', () => {
    const sharedIds: string[] = [];
    const shares = (pe: string, pp: string) => ({
      shares: { [env.products.p1]: pe, [env.products.p2]: pp },
    });
    async function sharedPlan(
      mode: string,
      recipe: { pe: string; pp: string },
      expected: number,
    ) {
      const unit = env.world.unitA2;
      const pe = await env.profile(
        unit,
        env.products.p1,
        {
          operatingMode: mode,
          capacityModel: 'shared_capacity',
          productMixConstraints: shares(recipe.pe, recipe.pp),
        },
        { planning: '100', sustained: '100' },
      );
      const pp = await env.profile(
        unit,
        env.products.p2,
        {
          operatingMode: mode,
          quantityUom: 'm3',
          capacityModel: 'shared_capacity',
          productMixConstraints: shares(recipe.pe, recipe.pp),
        },
        { planning: '40', sustained: '40' },
      );
      sharedIds.splice(0, 2, pe, pp);
      return preview(
        {
          unitId: unit,
          basis: 'time',
          headerTarget: null,
          validFrom: DAY1,
          validTo: DAY2,
          slices: [
            { productId: env.products.p1, profileId: pe, stream: 'shared' },
            { productId: env.products.p2, profileId: pp, stream: 'shared' },
          ],
        },
        expected,
      );
    }

    beforeAll(() => {
      process.env.CONCURRENT_PRODUCTS = 'true';
    });

    it('refuses an infeasible combined rate (shares above the shared capacity)', async () => {
      const response = await sharedPlan(
        'shared-bad',
        { pe: '0.7', pp: '0.5' },
        422,
      );
      expect((response.body as ApiError).code).toBe('INFEASIBLE_PRODUCT_MIX');
    });

    it('feasible recipe: separate slice targets on shared time; unlike units are not added', async () => {
      const response = await sharedPlan(
        'shared',
        { pe: '0.6', pp: '0.4' },
        200,
      );
      const body = response.body as PreviewBody;
      expect(
        body.periods.map((p) => [p.shiftName, p.quantityUom, p.target]),
      ).toEqual([
        ['A', 't', '480'],
        ['A', 'm3', '128'],
        ['B', 't', '480'],
        ['B', 'm3', '128'],
        ['C', 't', '480'],
        ['C', 'm3', '128'],
      ]);
      expect(body.totals).toEqual([
        { quantityUom: 't', target: '1440' },
        { quantityUom: 'm3', target: '384' },
      ]);
      expect(body.headerTarget).toBeNull();
    });

    it('a header target over slices in different units is refused (MIXED_UOM)', async () => {
      const [pe, pp] = sharedIds;
      const plan = await env.createPlan({
        unitId: env.world.unitA2,
        headerTarget: '100',
        slices: [
          { productId: env.products.p1, profileId: pe, stream: 'independent' },
          { productId: env.products.p2, profileId: pp, stream: 'independent' },
        ],
      });
      const response = await env
        .post(`production-plans/${plan.id}/generate-periods`, {
          version: 1,
          preview: true,
        })
        .expect(422);
      expect((response.body as ApiError).code).toBe('MIXED_UOM');
    });
  });
});
