import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

interface UnitsBody {
  items: Array<{
    id: string;
    code: string;
    name: string;
    siteId: string | null;
  }>;
  nextCursor: string | null;
  scope: { tenantId: string; unitIds?: string[] };
}

/**
 * Plan 3.2: `GET /api/v2/units` feeds the Event Hub unit filter and form. Tenant from the identity,
 * unit-limited callers see only their units, tenant B never sees tenant A, keyset pages are stable,
 * `tenantId` in the query is 400 and no token is 401.
 */
describe('v2 units (plan 3.2)', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let analystA = '';
  let adminB = '';
  let unitOperator = '';

  const http = () => request(app.getHttpServer());
  const units = async (token: string, query = '') =>
    (await http().get(`/api/v2/units${query}`).set(bearer(token)).expect(200))
      .body as UnitsBody;

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, { modules: [V2Module] });
    analystA = signToken(app, {
      userId: randomUUID(),
      tenantId: world.tenantA,
      role: 'Analyst',
    });
    adminB = signToken(app, {
      userId: randomUUID(),
      tenantId: world.tenantB,
      role: 'TenantAdmin',
    });
    const operatorId = randomUUID();
    await harness.dataSource.query(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id) VALUES ($1, 'unit operator', $2, 'x', 'Operator', $3)`,
      [operatorId, `${operatorId}@test.local`, world.tenantA],
    );
    await harness.dataSource.query(
      `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version) VALUES ($1, $2, 'unit', $3, 'operator', 1)`,
      [world.tenantA, operatorId, world.unitA1],
    );
    unitOperator = signToken(app, {
      userId: operatorId,
      tenantId: world.tenantA,
      role: 'Operator',
    });
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  it('lists the tenant units only', async () => {
    const body = await units(analystA);
    const ids = body.items.map((unit) => unit.id).sort();
    expect(ids).toEqual([world.unitA1, world.unitA2, world.unitA3].sort());
    expect(body.scope).toEqual({ tenantId: world.tenantA });
    expect(typeof body.items[0].code).toBe('string');
    expect(body.items[0].siteId).toBeNull();
    const other = await units(adminB);
    expect(other.items.map((unit) => unit.id)).toEqual([world.unitB1]);
  });

  it('limits a unit-scoped caller to its units and names them in the scope', async () => {
    const body = await units(unitOperator);
    expect(body.items.map((unit) => unit.id)).toEqual([world.unitA1]);
    expect(body.scope.unitIds).toEqual([world.unitA1]);
  });

  it('pages with a keyset cursor without repeats', async () => {
    const first = await units(analystA, '?limit=2');
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();
    const second = await units(
      analystA,
      `?limit=2&cursor=${encodeURIComponent(first.nextCursor ?? '')}`,
    );
    const all = [...first.items, ...second.items].map((unit) => unit.id);
    expect(new Set(all).size).toBe(3);
    expect(second.nextCursor).toBeNull();
  });

  it('reports asset presence per unit, counting only active assets', async () => {
    await harness.dataSource.query(
      `INSERT INTO assets (code, name, unit_id, tenant_id, organization_id, retired_at) SELECT 'RET-' || $1::text, 'Retired asset', $2::text, $3::uuid, organization_id, now() FROM units WHERE id = $2::uuid`,
      [world.unitA2.slice(0, 8), world.unitA2, world.tenantA],
    );
    const read = async (token: string) =>
      (
        await http()
          .get('/api/v2/units/asset-presence')
          .set(bearer(token))
          .expect(200)
      ).body as {
        data: { items: Array<{ unitId: string; hasAssets: boolean }> };
      };
    const presence = new Map(
      (await read(analystA)).data.items.map((row) => [
        row.unitId,
        row.hasAssets,
      ]),
    );
    expect(presence.get(world.unitA1)).toBe(true);
    expect(presence.get(world.unitA2)).toBe(false);
    expect(presence.has(world.unitB1)).toBe(false);
    const limited = (await read(unitOperator)).data.items;
    expect(limited.map((row) => row.unitId)).toEqual([world.unitA1]);
  });

  it('rejects tenantId in the query (400) and anonymous calls (401)', async () => {
    await http()
      .get(`/api/v2/units?tenantId=${world.tenantB}`)
      .set(bearer(analystA))
      .expect(400);
    await http().get('/api/v2/units').expect(401);
  });
});
