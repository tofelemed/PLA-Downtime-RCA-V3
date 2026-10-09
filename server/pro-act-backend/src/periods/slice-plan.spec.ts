import { BaselinePlanRow, planSlices, ProfileRow } from './slice-plan';

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

describe('planSlices (plan 2.4, §3.1)', () => {
  it('takes the accounting-baseline plan periods first', () => {
    const plan = planSlices(
      period,
      [planRow()],
      [profile(), profile({ id: 'prof-2', productId: 'p2' })],
    );
    expect(plan.planVersionId).toBe('pv-1');
    expect(plan.slices).toEqual([
      expect.objectContaining({
        productId: 'p2',
        profileId: 'prof-2',
        planPeriodId: 'pp-1',
        source: 'plan',
      }),
    ]);
  });

  it('concurrent products: one slice per product over the same window', () => {
    const plan = planSlices(
      period,
      [planRow(), planRow({ planPeriodId: 'pp-2', productId: 'p3' })],
      [],
    );
    expect(plan.slices.map((s) => s.productId)).toEqual(['p2', 'p3']);
    expect(new Set(plan.slices.map((s) => s.windowFrom.getTime())).size).toBe(
      1,
    );
  });

  it('without a plan the single approved profile gives the default product', () => {
    const plan = planSlices(period, [], [profile()]);
    expect(plan.slices).toEqual([
      expect.objectContaining({ productId: 'p1', source: 'profile_default' }),
    ]);
  });

  it('several default candidates or none leave the period without slices and say why', () => {
    expect(
      planSlices(period, [], [profile(), profile({ id: 'x', productId: 'p9' })])
        .warnings[0].code,
    ).toBe('ambiguous_default_product');
    expect(planSlices(period, [], []).warnings[0].code).toBe('no_profile');
  });
});
