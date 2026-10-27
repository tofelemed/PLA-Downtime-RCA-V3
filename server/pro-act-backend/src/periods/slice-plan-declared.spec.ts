import { BaselinePlanRow, planSlices, ProfileRow } from './slice-plan';
import { planDeclaredSlice } from './slice-plan-declared';

const t = (hhmm: string) => new Date(`2027-03-01T${hhmm}:00Z`);
const period = { unitId: 'u1', utcStart: t('02:30'), utcEnd: t('10:30') };

const profile = (overrides: Partial<ProfileRow> = {}): ProfileRow => ({
  id: 'prof-1',
  unitId: 'u1',
  productId: 'p1',
  quantityUom: 't',
  effectiveFrom: new Date('2026-01-01T00:00:00Z'),
  effectiveTo: null,
  actualsPolicyId: null,
  ...overrides,
});

const planRow = (
  overrides: Partial<BaselinePlanRow> = {},
): BaselinePlanRow => ({
  planPeriodId: 'pp-1',
  planVersionId: 'pv-1',
  unitId: 'u1',
  productId: 'p2',
  profileId: null,
  quantityUom: 't',
  utcStart: t('02:30'),
  utcEnd: t('10:30'),
  campaignFrom: null,
  campaignTo: null,
  ...overrides,
});

const twoProfiles = [
  profile(),
  profile({ id: 'prof-2', productId: 'p2', actualsPolicyId: 'pol-2' }),
];

describe('planDeclaredSlice (declared mode, D4)', () => {
  it('a plan covering the window gives its product over the whole period', () => {
    const plan = planDeclaredSlice(period, [planRow()], twoProfiles, 'p1');
    expect(plan.planVersionId).toBe('pv-1');
    expect(plan.slices).toEqual([
      expect.objectContaining({
        productId: 'p2',
        profileId: 'prof-2',
        planPeriodId: 'pp-1',
        source: 'plan',
        windowFrom: period.utcStart,
        windowTo: period.utcEnd,
      }),
    ]);
  });

  it('a campaign change keeps one slice: the plan period covering most of the window', () => {
    const rows = [
      planRow({ utcEnd: t('04:30') }),
      planRow({ planPeriodId: 'pp-2', productId: 'p1', utcStart: t('04:30') }),
    ];
    const plan = planDeclaredSlice(period, rows, twoProfiles, null);
    expect(plan.slices).toHaveLength(1);
    expect(plan.slices[0]).toMatchObject({
      productId: 'p1',
      planPeriodId: 'pp-2',
      windowFrom: period.utcStart,
      windowTo: period.utcEnd,
    });
    expect(planSlices(period, rows, twoProfiles).slices).toHaveLength(2);
  });

  it('without a plan the single approved profile gives the product', () => {
    const plan = planDeclaredSlice(period, [], [profile()], 'p9');
    expect(plan.slices).toEqual([
      expect.objectContaining({
        productId: 'p1',
        profileId: 'prof-1',
        source: 'profile_default',
      }),
    ]);
  });

  it('two profiles and a policy product: that product with its approved profile', () => {
    const plan = planDeclaredSlice(period, [], twoProfiles, 'p2');
    expect(plan.warnings).toEqual([]);
    expect(plan.slices).toEqual([
      {
        productId: 'p2',
        profileId: 'prof-2',
        planPeriodId: null,
        source: 'profile_default',
        windowFrom: period.utcStart,
        windowTo: period.utcEnd,
        campaignFrom: null,
        campaignTo: null,
        quantityUom: 't',
        pinnedPolicyId: 'pol-2',
      },
    ]);
  });

  it('a policy product without an approved profile gets a slice without a profile', () => {
    const plan = planDeclaredSlice(period, [], twoProfiles, 'p7');
    expect(plan.slices).toEqual([
      expect.objectContaining({
        productId: 'p7',
        profileId: null,
        quantityUom: null,
        pinnedPolicyId: null,
      }),
    ]);
  });

  it('two profiles and no policy product keep the ambiguous_default_product warning', () => {
    const plan = planDeclaredSlice(period, [], twoProfiles, null);
    expect(plan.slices).toEqual([]);
    expect(plan.warnings.map((w) => w.code)).toEqual([
      'ambiguous_default_product',
    ]);
  });
});
