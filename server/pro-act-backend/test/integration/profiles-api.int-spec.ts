import { randomUUID } from 'crypto';
import {
  ApiError,
  itemsOf,
  ProfileBody,
  ProfileWorld,
  RateBody,
} from './support/profile-world';
import { signToken } from './support/test-app';

interface ResolutionBody {
  profile: ProfileBody | null;
  reason: string | null;
  rates: Record<string, RateBody>;
}

/**
 * Plan 2.2 v2 API: profile versions (draft → approved / retired, no overlapping approved versions,
 * supersede at the boundary), rate versions (T30 input: 100 t/h until 10:30, 120 t/h after), profile
 * resolution (`no_profile`), tenant isolation (foreign path ids 404, foreign body ids 422
 * INVALID_REFERENCE), write roles and unit scope.
 */
describe('production profiles and rates (plan 2.2, v2 API)', () => {
  const env = new ProfileWorld();
  let profileA1: ProfileBody;
  let rateV1: RateBody;

  beforeAll(() => env.start());
  afterAll(() => env.stop());

  const codeOf = async (call: Promise<{ body: unknown }>): Promise<string> =>
    ((await call).body as ApiError).code;

  it('needs a writer role (403 for an analyst), an Idempotency-Key (428) and a token (401)', async () => {
    const body = {
      unitId: env.world.unitA1,
      productId: env.products.p1,
      quantityUom: 't',
      rateTimebase: 'h',
      effectiveFrom: '2026-10-01T00:00:00Z',
    };
    await env.post('profiles', body, env.analyst).expect(403);
    await env
      .http()
      .post('/api/v2/profiles')
      .set('Authorization', `Bearer ${env.admin}`)
      .send(body)
      .expect(428);
    await env.http().get('/api/v2/profiles').expect(401);
  });

  it('refuses foreign unit and product ids (422 INVALID_REFERENCE) and invalid validity', async () => {
    const base = {
      unitId: env.world.unitA1,
      productId: env.products.p1,
      quantityUom: 't',
      rateTimebase: 'h',
      effectiveFrom: '2026-10-01T00:00:00Z',
    };
    const refused = (body: object) =>
      codeOf(env.post('profiles', body).expect(422));
    expect(await refused({ ...base, unitId: env.world.unitB1 })).toBe(
      'INVALID_REFERENCE',
    );
    expect(await refused({ ...base, productId: env.products.pB })).toBe(
      'INVALID_REFERENCE',
    );
    expect(
      await refused({ ...base, effectiveTo: '2026-09-01T00:00:00Z' }),
    ).toBe('INVALID_EFFECTIVE_DATES');
    expect(
      await refused({ ...base, effectiveFrom: '2026-10-01T00:00:00' }),
    ).toBe('VALIDATION_FAILED');
    expect(await refused({ ...base, rateTimebase: 'week' })).toBe(
      'VALIDATION_FAILED',
    );
  });

  it('creates and approves a profile; tenant B sees nothing and gets 404 on its ids', async () => {
    profileA1 = await env.profile();
    expect(profileA1).toMatchObject({
      state: 'approved',
      version: 1,
      effectiveTo: null,
    });
    const fetched = await env.get(`profiles/${profileA1.id}`).expect(200);
    expect(fetched.headers.etag).toBe(
      `"${(fetched.body as ProfileBody).rowVersion}"`,
    );
    await env.get(`profiles/${profileA1.id}`, env.adminB).expect(404);
    await env
      .post(`profiles/${profileA1.id}/approve`, {}, env.adminB)
      .expect(404);
    await env
      .post(
        `profiles/${profileA1.id}/rates`,
        {
          rateKind: 'sustained',
          rate: '1',
          timebase: 'h',
          effectiveFrom: '2026-10-02T00:00:00Z',
        },
        env.adminB,
      )
      .expect(404);
    await env.get(`profiles/${profileA1.id}/rates`, env.adminB).expect(404);
    expect(itemsOf(await env.get('profiles', env.adminB).expect(200))).toEqual(
      [],
    );
    expect(
      await codeOf(
        env.post(`profiles/${profileA1.id}/approve`, {}).expect(409),
      ),
    ).toBe('INVALID_TRANSITION');
  });

  it('refuses an overlapping approved profile version (409 with the conflicting version), supersedes at the boundary', async () => {
    const v1 = await env.profile({ unitId: env.world.unitA2 });
    const v2 = await env.profile(
      {
        unitId: env.world.unitA2,
        effectiveFrom: '2026-11-01T00:00:00Z',
        quantityUom: 'kg',
      },
      false,
    );
    expect(v2).toMatchObject({ version: 2, state: 'draft' });
    const own = await env.post(`profiles/${v2.id}/approve`, {}).expect(403);
    expect((own.body as ApiError).code).toBe('SEPARATION_OF_DUTIES');
    const refused = await env
      .post(`profiles/${v2.id}/approve`, {}, env.approver)
      .expect(409);
    const error = refused.body as ApiError;
    expect(error.code).toBe('VERSION_OVERLAP');
    expect(error.details?.conflicts).toEqual([
      expect.objectContaining({ id: v1.id, version: 1 }),
    ]);
    await env
      .post(`profiles/${v2.id}/approve`, { supersede: true }, env.approver)
      .expect(200);
    const closed = (await env.get(`profiles/${v1.id}`).expect(200))
      .body as ProfileBody;
    expect(closed.effectiveTo).toBe('2026-11-01T00:00:00.000Z');
    const resolve = (at: string) =>
      env
        .get(
          `profiles/resolve?unitId=${env.world.unitA2}&productId=${env.products.p1}&at=${at}`,
        )
        .expect(200)
        .then((r) => (r.body as ResolutionBody).profile?.version);
    expect(await resolve('2026-10-31T23:59:59Z')).toBe(1);
    expect(await resolve('2026-11-01T00:00:00Z')).toBe(2);
  });

  it('edits drafts only with If-Match; approved versions are immutable', async () => {
    const draft = await env.profile(
      { unitId: env.world.unitA3, productId: env.products.p2 },
      false,
    );
    await env
      .http()
      .patch(`/api/v2/profiles/${draft.id}`)
      .set('Authorization', `Bearer ${env.admin}`)
      .send({ quantityUom: 'kg' })
      .expect(428);
    await env
      .patch(`profiles/${draft.id}`, { quantityUom: 'kg' }, '"999"')
      .expect(412);
    const edited = await env
      .patch(
        `profiles/${draft.id}`,
        { quantityUom: 'kg' },
        `"${draft.rowVersion}"`,
      )
      .expect(200);
    expect(edited.body).toMatchObject({ quantityUom: 'kg', state: 'draft' });
    await env.patch(`profiles/${draft.id}`, {}, '"1"', env.adminB).expect(404);
    expect(
      await codeOf(
        env
          .patch(
            `profiles/${profileA1.id}`,
            { quantityUom: 'kg' },
            `"${profileA1.rowVersion}"`,
          )
          .expect(409),
      ),
    ).toBe('VERSION_NOT_DRAFT');
    await env.rows(
      `UPDATE production_profiles SET quantity_uom = NULL WHERE id = $1`,
      [draft.id],
    );
    expect(
      await codeOf(env.post(`profiles/${draft.id}/approve`, {}).expect(422)),
    ).toBe('PROFILE_INCOMPLETE');
  });

  it('T30 input: approving an overlapping sustained rate is 409; supersede closes v1 exactly at 10:30', async () => {
    rateV1 = await env.rate(profileA1.id, {
      rate: '100',
      effectiveFrom: '2026-10-01T00:00:00Z',
    });
    const v2 = await env.rate(
      profileA1.id,
      { rate: '120', effectiveFrom: '2026-10-09T10:30:00Z' },
      null,
    );
    expect(v2).toMatchObject({
      version: 2,
      state: 'draft',
      ratePerSecond: '0.03333333',
    });
    const own = await env.post(`rates/${v2.id}/approve`, {}).expect(403);
    expect((own.body as ApiError).code).toBe('SEPARATION_OF_DUTIES');
    const refused = await env
      .post(`rates/${v2.id}/approve`, {}, env.approver)
      .expect(409);
    const error = refused.body as ApiError;
    expect(error.code).toBe('VERSION_OVERLAP');
    expect(error.details?.conflicts).toEqual([
      expect.objectContaining({ id: rateV1.id, version: 1 }),
    ]);
    await env
      .post(`rates/${v2.id}/approve`, { supersede: true }, env.approver)
      .expect(200);
    const closed = (await env.get(`rates/${rateV1.id}`).expect(200))
      .body as RateBody;
    expect(closed).toMatchObject({
      state: 'approved',
      effectiveTo: '2026-10-09T10:30:00.000Z',
    });
    const at = async (instant: string) => {
      const body = (
        await env
          .get(
            `profiles/resolve?unitId=${env.world.unitA1}&productId=${env.products.p1}&at=${instant}`,
          )
          .expect(200)
      ).body as ResolutionBody;
      return body.rates.sustained;
    };
    expect(await at('2026-10-09T10:15:00Z')).toMatchObject({
      rate: '100',
      ratePerSecond: '0.02777778',
    });
    expect(await at('2026-10-09T10:30:00Z')).toMatchObject({ rate: '120' });
    expect(await at('2026-10-09T10:45:00Z')).toMatchObject({
      rate: '120',
      ratePerSecond: '0.03333333',
    });
    const listed = await env
      .get(`profiles/${profileA1.id}/rates?rateKind=sustained`)
      .expect(200);
    expect(itemsOf<RateBody>(listed).map((r) => r.version)).toEqual([1, 2]);
  });

  it('resolves to no_profile without an approved profile and refuses foreign references', async () => {
    const none = await env
      .get(
        `profiles/resolve?unitId=${env.world.unitA1}&productId=${env.products.p2}&at=2026-10-09T10:00:00Z`,
      )
      .expect(200);
    expect(none.body).toEqual({
      profile: null,
      reason: 'no_profile',
      rates: {},
    });
    const early = await env
      .get(
        `profiles/resolve?unitId=${env.world.unitA1}&productId=${env.products.p1}&at=2026-09-01T00:00:00Z`,
      )
      .expect(200);
    expect((early.body as ResolutionBody).reason).toBe('no_profile');
    expect(
      await codeOf(
        env
          .get(
            `profiles/resolve?unitId=${env.world.unitB1}&productId=${env.products.p1}&at=2026-10-09T10:00:00Z`,
          )
          .expect(422),
      ),
    ).toBe('INVALID_REFERENCE');
  });

  it('validates rates (INVALID_RATE, RATE_OUTSIDE_PROFILE) and retires without deleting', async () => {
    const post = (body: object) =>
      env.post(`profiles/${profileA1.id}/rates`, body);
    const base = {
      rateKind: 'sustained',
      rate: '0',
      timebase: 'h',
      effectiveFrom: '2026-10-05T00:00:00Z',
    };
    expect(await codeOf(post(base).expect(422))).toBe('INVALID_RATE');
    await post({ ...base, rateKind: 'budget' }).expect(201);
    expect(
      await codeOf(
        post({
          ...base,
          rate: '5',
          effectiveFrom: '2026-09-01T00:00:00Z',
        }).expect(422),
      ),
    ).toBe('RATE_OUTSIDE_PROFILE');
    expect(await codeOf(post({ ...base, rate: '-5' }).expect(422))).toBe(
      'VALIDATION_FAILED',
    );
    const planning = await env.rate(profileA1.id, {
      rateKind: 'planning',
      rate: '90',
      effectiveFrom: '2026-10-01T00:00:00Z',
    });
    await env.post(`rates/${planning.id}/retire`, {}, env.adminB).expect(404);
    await env.post(`rates/${planning.id}/retire`, {}, env.analyst).expect(403);
    const retired = await env
      .post(`rates/${planning.id}/retire`, {})
      .expect(200);
    expect(retired.body).toMatchObject({ state: 'retired' });
    const events = await env.rows<{ n: number }>(
      `SELECT count(*)::int AS n FROM outbox WHERE type = 'ProfileBaselineChanged' AND payload->>'id' = $1`,
      [planning.id],
    );
    expect(events[0].n).toBe(2);
  });

  it('limits a unit-scoped writer to its unit', async () => {
    const ds = env.harness.dataSource;
    const userId = randomUUID();
    await ds.query(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id) VALUES ($1, 'unit writer', $2, 'x', 'Operator', $3)`,
      [userId, `${userId}@test.local`, env.world.tenantA],
    );
    await ds.query(
      `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version)
       VALUES ($1, $2, 'unit', $3, 'master_data_admin', 1)`,
      [env.world.tenantA, userId, env.world.unitA3],
    );
    const token = signToken(env.app, {
      userId,
      tenantId: env.world.tenantA,
      role: 'Operator',
    });
    const body = {
      productId: env.products.p1,
      quantityUom: 't',
      rateTimebase: 'h',
      effectiveFrom: '2026-10-01T00:00:00Z',
    };
    expect(
      await codeOf(
        env
          .post('profiles', { ...body, unitId: env.world.unitA1 }, token)
          .expect(422),
      ),
    ).toBe('INVALID_REFERENCE');
    await env
      .post('profiles', { ...body, unitId: env.world.unitA3 }, token)
      .expect(201);
    await env.get(`profiles/${profileA1.id}`, token).expect(404);
    const listed = itemsOf<ProfileBody>(
      await env.get('profiles', token).expect(200),
    );
    expect(new Set(listed.map((p) => p.unitId))).toEqual(
      new Set([env.world.unitA3]),
    );
    await env.post(`rates/${rateV1.id}/approve`, {}, token).expect(403);
  });
});
