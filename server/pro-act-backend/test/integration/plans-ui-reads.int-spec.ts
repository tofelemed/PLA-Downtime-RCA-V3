import { randomUUID } from 'crypto';
import { bearer, signToken } from './support/test-app';
import { PlanWorld, VersionBody } from './support/plan-world';

interface ListBody<T> {
  items: T[];
  nextCursor: string | null;
  scope: { tenantId: string; unitIds?: string[] };
}

interface ProductBody {
  id: string;
  code: string;
  name: string;
  uom: string | null;
  isActive: boolean;
}

/**
 * Plan 3.4 reads added for the plans / profiles UI: `GET /api/v2/products` (tenant master data for the
 * pickers; tenant from the identity, no `tenantId` parameter, no legacy cost) and
 * `GET /api/v2/production-plans/{id}/versions` (history newest first, supersession visible, keyset
 * pages, foreign and out-of-scope plans 404).
 */
describe('v2 reads for the plans / profiles UI (plan 3.4)', () => {
  const env = new PlanWorld();
  let unitOperator = '';

  beforeAll(async () => {
    await env.start();
    const operatorId = randomUUID();
    await env.rows(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id) VALUES ($1, 'unit operator', $2, 'x', 'Operator', $3)`,
      [operatorId, `${operatorId}@test.local`, env.world.tenantA],
    );
    await env.rows(
      `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version) VALUES ($1, $2, 'unit', $3, 'operator', 1)`,
      [env.world.tenantA, operatorId, env.world.unitA2],
    );
    unitOperator = signToken(env.app, {
      userId: operatorId,
      tenantId: env.world.tenantA,
      role: 'Operator',
    });
  });
  afterAll(() => env.stop());

  it('lists the tenant products only, without the legacy cost', async () => {
    const mine = (await env.get('products').expect(200))
      .body as ListBody<ProductBody>;
    expect(mine.items.map((p) => p.id).sort()).toEqual(
      [env.products.p1, env.products.p2].sort(),
    );
    const [item] = mine.items;
    expect(Object.keys(item).sort()).toEqual([
      'code',
      'id',
      'isActive',
      'name',
      'uom',
    ]);
    expect(item.code).toMatch(/^HDPE-/);
    expect(item).toMatchObject({ uom: 't', isActive: true });
    expect(mine.scope).toEqual({ tenantId: env.world.tenantA });
    const other = (await env.get('products', env.adminB).expect(200))
      .body as ListBody<ProductBody>;
    expect(other.items.map((p) => p.id)).toEqual([env.products.pB]);
  });

  it('pages products with a keyset cursor; tenantId in the query is 400, no token 401', async () => {
    const first = (await env.get('products?limit=1').expect(200))
      .body as ListBody<ProductBody>;
    expect(first.items).toHaveLength(1);
    const second = (
      await env
        .get(
          `products?limit=1&cursor=${encodeURIComponent(first.nextCursor ?? '')}`,
        )
        .expect(200)
    ).body as ListBody<ProductBody>;
    expect(second.items[0].id).not.toBe(first.items[0].id);
    expect(second.nextCursor).toBeNull();
    await env.get(`products?tenantId=${env.world.tenantB}`).expect(400);
    await env.http().get('/api/v2/products').expect(401);
  });

  it('lists plan versions newest first with supersession; pages; foreign plans 404', async () => {
    const plan = await env.createPlan({ name: 'history' });
    await env.generate(plan.id, 1);
    await env
      .post(`production-plans/${plan.id}/approve`, { expectedVersion: 1 })
      .expect(200);
    await env
      .post(`production-plans/${plan.id}/versions`, {
        headerTarget: '900',
        changeReason: 'less demand',
      })
      .expect(201);
    const history = (
      await env.get(`production-plans/${plan.id}/versions`).expect(200)
    ).body as ListBody<VersionBody & { changeReason: string | null }>;
    expect(
      history.items.map((v) => [v.version, v.approvalState, v.headerTarget]),
    ).toEqual([
      [2, 'draft', '900'],
      [1, 'approved', '1000'],
    ]);
    expect(history.items[0]).not.toHaveProperty('slices');
    const page = (
      await env.get(`production-plans/${plan.id}/versions?limit=1`).expect(200)
    ).body as ListBody<VersionBody>;
    expect(page.items.map((v) => v.version)).toEqual([2]);
    const rest = (
      await env
        .get(
          `production-plans/${plan.id}/versions?limit=1&cursor=${encodeURIComponent(page.nextCursor ?? '')}`,
        )
        .expect(200)
    ).body as ListBody<VersionBody>;
    expect(rest.items.map((v) => v.version)).toEqual([1]);
    await env
      .get(`production-plans/${plan.id}/versions`, env.adminB)
      .expect(404);
    await env
      .get(`production-plans/${plan.id}/versions`, unitOperator)
      .expect(404);
    await env
      .http()
      .get(`/api/v2/production-plans/${plan.id}/versions?sort=version`)
      .set(bearer(env.admin))
      .expect(422);
  });
});
