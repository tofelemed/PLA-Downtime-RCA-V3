import { randomUUID } from 'crypto';
import { ApiError, ProfileBody, ProfileWorld } from './support/profile-world';
import { signToken } from './support/test-app';

interface KindBody {
  value: string | null;
  rateVersionId: string | null;
  timebase: string | null;
}

interface RowBody {
  profileId: string;
  unitId: string;
  productId: string;
  quantityUom: string;
  rates: Record<string, KindBody>;
  gaps: Array<{
    upper: string;
    lower: string;
    gap: string | null;
    ratio: string | null;
    reason: string | null;
  }>;
  ratios: Array<{ ratio: string | null; reason: string | null }>;
}

interface ReportBody {
  at: string;
  items: RowBody[];
  limit: number;
  truncated: boolean;
}

/**
 * Plan 1.2 capacity gap report: only approved profile and rate versions in force at `at` (drafts never
 * count, superseded versions only before their successor), gaps from the server's decimal maths, tenant
 * and unit scope (foreign or out-of-scope units 422, unit-limited callers see their units only), bounded
 * rows with `truncated`.
 */
describe('capacity gap report (plan 1.2)', () => {
  const env = new ProfileWorld();
  let a1: ProfileBody;
  let sustainedV1 = '';
  let sustainedV2 = '';
  let unitLimited = '';

  const report = async (query: string, token = env.admin) =>
    (await env.get(`reports/capacity-gap?${query}`, token).expect(200))
      .body as ReportBody;

  beforeAll(async () => {
    await env.start();
    a1 = await env.profile();
    const rate = (rateKind: string, value: string, from: string) =>
      env.rate(a1.id, { rateKind, rate: value, effectiveFrom: from });
    await rate('nameplate', '150', '2026-10-01T00:00:00Z');
    await rate('demonstrated', '132', '2026-10-01T00:00:00Z');
    sustainedV1 = (await rate('sustained', '120', '2026-10-01T00:00:00Z')).id;
    sustainedV2 = (
      await env.rate(
        a1.id,
        {
          rateKind: 'sustained',
          rate: '125.5',
          effectiveFrom: '2026-10-15T00:00:00Z',
        },
        { supersede: true },
      )
    ).id;
    // a draft planning rate is never used
    await env.rate(
      a1.id,
      {
        rateKind: 'planning',
        rate: '110',
        effectiveFrom: '2026-10-01T00:00:00Z',
      },
      null,
    );
    await env.profile({ unitId: env.world.unitA2 });
    await env.profile({ productId: env.products.p2 }, false);
    unitLimited = await limitedTo(env.world.unitA2);
  });
  afterAll(() => env.stop());

  async function limitedTo(unitId: string): Promise<string> {
    const userId = randomUUID();
    await env.rows(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id)
       VALUES ($1, 'unit reader', $2, 'x', 'Operator', $3)`,
      [userId, `${userId}@test.local`, env.world.tenantA],
    );
    await env.rows(
      `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version)
       VALUES ($1, $2, 'unit', $3, 'manager_approver', 1)`,
      [env.world.tenantA, userId, unitId],
    );
    return signToken(env.app, {
      userId,
      tenantId: env.world.tenantA,
      role: 'Operator',
    });
  }

  it('uses the approved versions in force at `at`, never drafts', async () => {
    const body = await report(
      `at=2026-10-10T00:00:00Z&unitIds=${env.world.unitA1}`,
    );
    expect(body.items).toHaveLength(1);
    const [row] = body.items;
    expect(row).toMatchObject({ profileId: a1.id, quantityUom: 't' });
    expect(row.rates.sustained).toMatchObject({
      value: '120',
      rateVersionId: sustainedV1,
      timebase: 'h',
    });
    expect(row.rates.planning).toMatchObject({
      value: null,
      rateVersionId: null,
    });
    expect(row.gaps).toEqual([
      {
        upper: 'nameplate',
        lower: 'demonstrated',
        gap: '18',
        ratio: '0.12',
        reason: null,
      },
      {
        upper: 'demonstrated',
        lower: 'sustained',
        gap: '12',
        ratio: '0.09090909',
        reason: null,
      },
      {
        upper: 'sustained',
        lower: 'planning',
        gap: null,
        ratio: null,
        reason: 'not_set',
      },
    ]);
    expect(row.ratios.map((r) => [r.ratio, r.reason])).toEqual([
      ['0.8', null],
      [null, 'not_set'],
    ]);
  });

  it('follows effective dating: the successor from its start, nothing before the profile', async () => {
    const later = await report(
      `at=2026-10-20T00:00:00Z&unitIds=${env.world.unitA1}`,
    );
    expect(later.items[0].rates.sustained).toMatchObject({
      value: '125.5',
      rateVersionId: sustainedV2,
    });
    expect(later.items[0].gaps[1].gap).toBe('6.5');
    const before = await report(
      `at=2026-09-01T00:00:00Z&unitIds=${env.world.unitA1}`,
    );
    expect(before.items).toEqual([]);
  });

  it('lists approved profiles only, filtered by product, bounded by limit', async () => {
    const all = await report('at=2026-10-10T00:00:00Z');
    expect(all.items.map((row) => row.unitId).sort()).toEqual(
      [env.world.unitA1, env.world.unitA2].sort(),
    );
    expect(all.items.some((row) => row.productId === env.products.p2)).toBe(
      false,
    );
    const p2 = await report(
      `at=2026-10-10T00:00:00Z&productIds=${env.products.p2}`,
    );
    expect(p2.items).toEqual([]);
    const one = await report('at=2026-10-10T00:00:00Z&limit=1');
    expect(one).toMatchObject({ limit: 1, truncated: true });
    expect(one.items).toHaveLength(1);
    expect(all.truncated).toBe(false);
  });

  it('keeps tenants and unit scopes apart', async () => {
    const foreign = await report('at=2026-10-10T00:00:00Z', env.adminB);
    expect(foreign.items).toEqual([]);
    const own = await report('at=2026-10-10T00:00:00Z', unitLimited);
    expect(own.items.map((row) => row.unitId)).toEqual([env.world.unitA2]);
    const outOfScope = await env
      .get(`reports/capacity-gap?unitIds=${env.world.unitA1}`, unitLimited)
      .expect(422);
    expect((outOfScope.body as ApiError).code).toBe('INVALID_REFERENCE');
    const otherTenant = await env
      .get(`reports/capacity-gap?unitIds=${env.world.unitB1}`)
      .expect(422);
    expect((otherTenant.body as ApiError).code).toBe('INVALID_REFERENCE');
  });

  it('validates the query (offset-less instant, limit ≤ 200)', async () => {
    for (const query of ['at=2026-10-10T00:00:00', 'limit=201']) {
      const refused = await env
        .get(`reports/capacity-gap?${query}`)
        .expect(422);
      expect((refused.body as ApiError).code).toBe('VALIDATION_FAILED');
    }
  });
});
