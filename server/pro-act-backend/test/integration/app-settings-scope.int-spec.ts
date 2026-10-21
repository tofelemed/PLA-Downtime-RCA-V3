import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { AppSettingsModule } from '../../src/app-settings/app-settings.module';
import { IntegrationHarness } from './harness';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

interface Setting {
  key: string;
  tenantId: string | null;
  userId: string | null;
}

/**
 * Plan 3.11 (known issue: `app_settings` was global and writable by anyone): application-wide keys are
 * read by every signed-in user and written by SuperAdmin only; tenant keys stay inside their tenant;
 * per-user keys are private to their user, who may keep them even with a read-only role.
 */
describe('app settings scope (plan 3.11)', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  const ids = {
    a: randomUUID(),
    b: randomUUID(),
    viewer: randomUUID(),
    adminA: randomUUID(),
  };
  const tokens = { a: '', b: '', viewer: '', adminA: '', superAdmin: '' };

  const http = () => request(app.getHttpServer());
  const tabKey = (tenantId: string, userId: string) =>
    `tabVisibility.${tenantId}.${userId}`;
  const setValue = (token: string, key: string, value: unknown) =>
    http()
      .post(`/api/app-settings/${key}/value`)
      .set(bearer(token))
      .send({ value });
  const getValue = (token: string, key: string) =>
    http().get(`/api/app-settings/${key}/value`).set(bearer(token)).expect(200);

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, { modules: [AppSettingsModule] });
    const tenantA = world.tenantA;
    tokens.a = signToken(app, {
      userId: ids.a,
      tenantId: tenantA,
      role: 'Engineer',
    });
    tokens.b = signToken(app, {
      userId: ids.b,
      tenantId: world.tenantB,
      role: 'Engineer',
    });
    tokens.viewer = signToken(app, {
      userId: ids.viewer,
      tenantId: tenantA,
      role: 'viewer',
    });
    tokens.adminA = signToken(app, {
      userId: ids.adminA,
      tenantId: tenantA,
      role: 'TenantAdmin',
    });
    tokens.superAdmin = signToken(app, {
      userId: randomUUID(),
      role: 'SuperAdmin',
    });
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  it('keeps per-user preferences private to their user, viewers included', async () => {
    const own = tabKey(world.tenantA, ids.a);
    const saved = await setValue(tokens.a, own, {
      visibleTabs: { IOW: false },
    }).expect(201);
    expect(saved.body as Setting).toMatchObject({
      tenantId: world.tenantA,
      userId: ids.a,
    });
    expect((await getValue(tokens.a, own)).body).toEqual({
      visibleTabs: { IOW: false },
    });

    // another tenant's user: invisible and not writable
    expect((await getValue(tokens.b, own)).text).toBe('');
    const refused = await setValue(tokens.b, own, { visibleTabs: {} }).expect(
      403,
    );
    expect((refused.body as { code: string }).code).toBe(
      'SETTING_NOT_WRITABLE',
    );
    // nor can a user claim a key for the same user id in a tenant it does not belong to
    await setValue(tokens.b, tabKey(world.tenantA, ids.b), {}).expect(403);

    await setValue(tokens.viewer, tabKey(world.tenantA, ids.viewer), {
      visibleTabs: {},
    }).expect(201);
    await setValue(tokens.viewer, own, {}).expect(403);
  });

  // an application-wide key other than `branding`, which only `PUT /v2/branding` writes (21 Oct 2026)
  it('lets only a SuperAdmin change application-wide settings, readable by everyone', async () => {
    const denied = await setValue(tokens.adminA, 'appNotice', {
      appName: 'X',
    }).expect(403);
    expect((denied.body as { code: string }).code).toBe('SETTING_NOT_WRITABLE');
    await http()
      .post('/api/app-settings')
      .set(bearer(tokens.a))
      .send({ key: 'anything', value: 'v' })
      .expect(403);
    await setValue(tokens.superAdmin, 'appNotice', {
      appName: 'Traverse Forge',
    }).expect(201);
    expect((await getValue(tokens.b, 'appNotice')).body).toEqual({
      appName: 'Traverse Forge',
    });
    await http()
      .delete('/api/app-settings/appNotice')
      .set(bearer(tokens.a))
      .expect(403);
  });

  it('keeps tenant settings inside their tenant and lists only what the caller may read', async () => {
    await harness.dataSource.query(
      `INSERT INTO app_settings (key, value, tenant_id) VALUES ('plantSelection', '{"tenant":{"id":"${world.tenantA}"}}', $1)`,
      [world.tenantA],
    );
    expect((await getValue(tokens.b, 'plantSelection')).text).toBe('');
    expect((await getValue(tokens.a, 'plantSelection')).body).toEqual({
      tenant: { id: world.tenantA },
    });
    await http()
      .put('/api/app-settings/plantSelection')
      .set(bearer(tokens.a))
      .send({ value: '{}' })
      .expect(403);
    await http()
      .put('/api/app-settings/plantSelection')
      .set(bearer(tokens.adminA))
      .send({ value: '{}' })
      .expect(200);

    const listB = await http()
      .get('/api/app-settings')
      .set(bearer(tokens.b))
      .expect(200);
    const keysB = (listB.body as Setting[]).map((setting) => setting.key);
    expect(keysB).toContain('appNotice');
    expect(keysB).not.toContain('plantSelection');
    expect(keysB).not.toContain(tabKey(world.tenantA, ids.a));
    const listA = await http()
      .get('/api/app-settings')
      .set(bearer(tokens.a))
      .expect(200);
    const keysA = (listA.body as Setting[]).map((setting) => setting.key);
    expect(keysA).toEqual(
      expect.arrayContaining([
        'appNotice',
        'plantSelection',
        tabKey(world.tenantA, ids.a),
      ]),
    );
    expect(keysA).not.toContain(tabKey(world.tenantA, ids.viewer));
  });

  it('lets SuperAdmin administer another user preference across plants', async () => {
    const key = tabKey(world.tenantB, ids.b);
    await setValue(tokens.b, key, { visibleTabs: { IOW: false } }).expect(201);
    expect((await getValue(tokens.superAdmin, key)).body).toEqual({
      visibleTabs: { IOW: false },
    });
    const listed = await http()
      .get('/api/app-settings')
      .set(bearer(tokens.superAdmin))
      .expect(200);
    expect((listed.body as Setting[]).map((setting) => setting.key)).toContain(
      key,
    );
    await setValue(tokens.superAdmin, key, {
      visibleTabs: { IOW: true },
    }).expect(201);
    expect((await getValue(tokens.b, key)).body).toEqual({
      visibleTabs: { IOW: true },
    });
    await http()
      .delete(`/api/app-settings/${key}`)
      .set(bearer(tokens.superAdmin))
      .expect(200);
    expect((await getValue(tokens.b, key)).text).toBe('');
  });
});
