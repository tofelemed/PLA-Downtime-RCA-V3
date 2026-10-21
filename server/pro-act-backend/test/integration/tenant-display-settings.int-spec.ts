import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { TenantModule } from '../../src/tenant/tenant.module';
import { IntegrationHarness } from './harness';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

/**
 * UI/UX audit §10 Option A: `PUT /tenants/:id/display-settings` follows the tenant-setting rule
 * (SuperAdmin, or a TenantAdmin / manager approver acting in the tenant); the tenant read returns it.
 */
describe('tenant display settings', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  const tokens = { adminA: '', adminB: '', engineerA: '', viewerA: '' };

  const http = () => request(app.getHttpServer());
  const put = (token: string, tenantId: string, body: object) =>
    http()
      .put(`/api/tenants/${tenantId}/display-settings`)
      .set(bearer(token))
      .send(body);
  const token = (tenantId: string, role: string) =>
    signToken(app, { userId: randomUUID(), tenantId, role });

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, { modules: [TenantModule] });
    tokens.adminA = token(world.tenantA, 'TenantAdmin');
    tokens.adminB = token(world.tenantB, 'TenantAdmin');
    tokens.engineerA = token(world.tenantA, 'Engineer');
    tokens.viewerA = token(world.tenantA, 'viewer');
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  it('lets the tenant administrator switch to the Persian calendar and reads it back', async () => {
    const before = await http()
      .get(`/api/tenants/${world.tenantA}`)
      .set(bearer(tokens.adminA))
      .expect(200);
    expect(before.body).toMatchObject({
      calendarSystem: 'gregorian',
      digits: 'latin',
    });
    const saved = await put(tokens.adminA, world.tenantA, {
      calendarSystem: 'persian',
    }).expect(200);
    expect(saved.body).toMatchObject({
      id: world.tenantA,
      calendarSystem: 'persian',
      digits: 'latin',
    });
    const after = await http()
      .get(`/api/tenants/${world.tenantA}`)
      .set(bearer(tokens.engineerA))
      .expect(200);
    expect(after.body).toMatchObject({ calendarSystem: 'persian' });
  });

  it('refuses unknown values and undeclared fields with 400', async () => {
    await put(tokens.adminA, world.tenantA, {
      calendarSystem: 'jalali',
    }).expect(400);
    await put(tokens.adminA, world.tenantA, { name: 'renamed' }).expect(400);
  });

  it('refuses other roles and other tenants', async () => {
    const engineer = await put(tokens.engineerA, world.tenantA, {
      digits: 'persian',
    }).expect(403);
    expect(engineer.body).toMatchObject({ code: 'FORBIDDEN_ROLE' });
    await put(tokens.viewerA, world.tenantA, { digits: 'persian' }).expect(403);
    const foreign = await put(tokens.adminB, world.tenantA, {
      digits: 'persian',
    }).expect(404);
    expect(foreign.body).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('audits the change with old and new values under the edited plant (21 Oct 2026)', async () => {
    await put(tokens.adminA, world.tenantA, { digits: 'persian' }).expect(200);
    const [row] = await harness.dataSource.query<
      Array<{ tenant_id: string; entity_type: string; details: string }>
    >(
      `SELECT "tenant_id", "entity_type", "details" FROM "audit_logs"
        WHERE "entity_id" = $1 AND "details" LIKE '%digits%' ORDER BY "timestamp" DESC LIMIT 1`,
      [world.tenantA],
    );
    expect(row).toMatchObject({
      tenant_id: world.tenantA,
      entity_type: 'Tenant',
    });
    const details = JSON.parse(row.details) as {
      message: string;
      changes: Record<string, { from: unknown; to: unknown }>;
    };
    expect(details.changes).toEqual({
      digits: { from: 'latin', to: 'persian' },
    });
    expect(details.message).toContain('digits latin → persian');
  });

  it('the v1 tenant update no longer writes the time zone, calendar or digits (422)', async () => {
    const superAdmin = token(world.tenantA, 'SuperAdmin');
    const refused = await http()
      .put(`/api/tenants/${world.tenantA}`)
      .set(bearer(superAdmin))
      .send({ timezone: 'Europe/Berlin' })
      .expect(422);
    expect(refused.body).toMatchObject({ code: 'PLANT_SETTING_V2_ONLY' });
    await http()
      .put(`/api/tenants/${world.tenantA}`)
      .set(bearer(superAdmin))
      .send({ digits: 'latin' })
      .expect(422);
  });
});
