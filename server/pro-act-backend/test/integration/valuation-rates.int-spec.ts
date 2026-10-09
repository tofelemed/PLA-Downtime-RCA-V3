import {
  ApiError,
  itemsOf,
  ProfileBody,
  ProfileWorld,
} from './support/profile-world';

/**
 * Plan 2.2 valuation rates (VAL01, D08): margin versions kept on profiles (approval without overlap,
 * supersede), cost per hour on impact codes, owner/basis/unit rules and tenant isolation (foreign body
 * ids 422 INVALID_REFERENCE, foreign path ids 404).
 */
describe('valuation rates (plan 2.2, v2 API)', () => {
  const env = new ProfileWorld();
  let profileA1: ProfileBody;

  beforeAll(async () => {
    await env.start();
    profileA1 = await env.profile();
  });
  afterAll(() => env.stop());

  const codeOf = async (call: Promise<{ body: unknown }>): Promise<string> =>
    ((await call).body as ApiError).code;

  it('keeps margin versions on profiles and cost per hour on impact codes (valuation rates)', async () => {
    const margin = (body: object = {}) =>
      env.post('valuation-rates', {
        profileId: profileA1.id,
        basis: 'contribution_margin',
        value: '42.5',
        currency: 'IRR',
        effectiveFrom: '2026-10-01T00:00:00Z',
        ...body,
      });
    const v1 = (await margin().expect(201)).body as {
      id: string;
      perUom: string;
      version: number;
    };
    expect(v1).toMatchObject({ perUom: 't', version: 1 });
    await env.post(`valuation-rates/${v1.id}/approve`, {}).expect(200);
    const v2 = (
      await margin({
        value: '45',
        effectiveFrom: '2026-11-01T00:00:00Z',
      }).expect(201)
    ).body as { id: string };
    expect(
      await codeOf(
        env.post(`valuation-rates/${v2.id}/approve`, {}).expect(409),
      ),
    ).toBe('VERSION_OVERLAP');
    await env
      .post(`valuation-rates/${v2.id}/approve`, { supersede: true })
      .expect(200);
    const listed = await env
      .get(`valuation-rates?profileId=${profileA1.id}&state=approved`)
      .expect(200);
    expect(itemsOf(listed)).toHaveLength(2);
    const refused = (body: object) =>
      codeOf(env.post('valuation-rates', body).expect(422));
    const hourly = {
      impactCodeId: env.impactCodes.iA,
      basis: 'cost_per_hour',
      value: '1000',
      currency: 'IRR',
      effectiveFrom: '2026-10-01T00:00:00Z',
    };
    await env.post('valuation-rates', hourly).expect(201);
    expect(await refused({ ...hourly, impactCodeId: env.impactCodes.iB })).toBe(
      'INVALID_REFERENCE',
    );
    expect(
      await refused({
        ...hourly,
        impactCodeId: undefined,
        profileId: profileA1.id,
      }),
    ).toBe('INVALID_OWNER');
    expect(await refused({ ...hourly, perUom: 'min' })).toBe('UOM_MISMATCH');
    expect(await codeOf(margin({ perUom: 'kg' }).expect(422))).toBe(
      'UOM_MISMATCH',
    );
    await env.get(`valuation-rates/${v1.id}`, env.adminB).expect(404);
    expect(
      itemsOf(await env.get('valuation-rates', env.adminB).expect(200)),
    ).toEqual([]);
  });

  it('refuses a profile id of another tenant in a valuation rate body (422 INVALID_REFERENCE)', async () => {
    const created = await env
      .post(
        'profiles',
        {
          unitId: env.world.unitB1,
          productId: env.products.pB,
          quantityUom: 't',
          rateTimebase: 'h',
          effectiveFrom: '2026-10-01T00:00:00Z',
        },
        env.adminB,
      )
      .expect(201);
    const body = {
      profileId: (created.body as ProfileBody).id,
      basis: 'standard_cost',
      value: '1',
      currency: 'IRR',
      effectiveFrom: '2026-10-01T00:00:00Z',
    };
    expect(await codeOf(env.post('valuation-rates', body).expect(422))).toBe(
      'INVALID_REFERENCE',
    );
  });
});
