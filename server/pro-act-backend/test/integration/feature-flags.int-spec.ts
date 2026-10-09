import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

interface FlagsBody {
  items: Array<{ key: string; enabled: boolean; overridden: boolean }>;
  scope: { tenantId: string };
}

/**
 * Plan 3.1 step 5: server-side feature flags per tenant. Every member reads them (registry defaults off);
 * only a tenant-wide manager switches one; tenant B never sees tenant A's switch; unknown keys are 404;
 * `tenantId` in the query is 400 and no token is 401.
 */
describe('v2 feature flags (plan 3.1)', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let adminA = '';
  let analystA = '';
  let adminB = '';
  let unitManager = '';

  const http = () => request(app.getHttpServer());
  const flags = async (token: string) =>
    (await http().get('/api/v2/feature-flags').set(bearer(token)).expect(200))
      .body as FlagsBody;
  const flag = (body: FlagsBody, key: string) =>
    body.items.find((item) => item.key === key);
  const put = (key: string, enabled: unknown, token: string) =>
    http()
      .put(`/api/v2/feature-flags/${key}`)
      .set(bearer(token))
      .send({ enabled });

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, { modules: [V2Module] });
    const token = (tenantId: string, role: string) =>
      signToken(app, { userId: randomUUID(), tenantId, role });
    adminA = token(world.tenantA, 'TenantAdmin');
    analystA = token(world.tenantA, 'Analyst');
    adminB = token(world.tenantB, 'TenantAdmin');
    const managerId = randomUUID();
    await harness.dataSource.query(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id) VALUES ($1, 'unit manager', $2, 'x', 'Operator', $3)`,
      [managerId, `${managerId}@test.local`, world.tenantA],
    );
    await harness.dataSource.query(
      `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version) VALUES ($1, $2, 'unit', $3, 'manager_approver', 1)`,
      [world.tenantA, managerId, world.unitA1],
    );
    unitManager = signToken(app, {
      userId: managerId,
      tenantId: world.tenantA,
      role: 'Operator',
    });
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  it('lists every known flag, off by default', async () => {
    const body = await flags(analystA);
    expect(body.scope.tenantId).toBe(world.tenantA);
    expect(flag(body, 'v2.eventHub')).toEqual(
      expect.objectContaining({ enabled: false, overridden: false }),
    );
    expect(body.items.every((item) => item.enabled === false)).toBe(true);
  });

  it('a tenant manager switches a flag for its tenant only; switching again is idempotent', async () => {
    const set = await put('v2.eventHub', true, adminA).expect(200);
    expect(set.body).toMatchObject({
      key: 'v2.eventHub',
      enabled: true,
      overridden: true,
    });
    await put('v2.eventHub', true, adminA).expect(200);
    expect(flag(await flags(analystA), 'v2.eventHub')?.enabled).toBe(true);
    expect(flag(await flags(adminB), 'v2.eventHub')?.enabled).toBe(false);
    const rows: Array<{ n: number }> = await harness.dataSource.query(
      `SELECT count(*)::int AS n FROM feature_flags WHERE key = 'v2.eventHub'`,
    );
    expect(rows[0].n).toBe(1);
    await put('v2.eventHub', false, adminA).expect(200);
    expect(flag(await flags(analystA), 'v2.eventHub')?.enabled).toBe(false);
  });

  it('refuses analysts (403), unit-limited managers (403 TENANT_SCOPE_REQUIRED), unknown keys (404), bad bodies (422)', async () => {
    await put('v2.eventHub', true, analystA).expect(403);
    const limited = await put('v2.eventHub', true, unitManager).expect(403);
    expect((limited.body as { code: string }).code).toBe(
      'TENANT_SCOPE_REQUIRED',
    );
    await put('v2.nope', true, adminA).expect(404);
    await http()
      .put('/api/v2/feature-flags/v2.eventHub')
      .set(bearer(adminA))
      .send({})
      .expect(422);
  });

  it('rejects tenantId in the query (400) and anonymous calls (401)', async () => {
    await http()
      .get(`/api/v2/feature-flags?tenantId=${world.tenantB}`)
      .set(bearer(adminA))
      .expect(400);
    await http().get('/api/v2/feature-flags').expect(401);
  });
});
