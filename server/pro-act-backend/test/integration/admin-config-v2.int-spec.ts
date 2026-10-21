import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import {
  AdminWorld,
  SeededUser,
  seedAdminWorld,
  seedUser,
} from './support/admin-world';
import { bodyOf } from './support/admin-world';
import { bearer, createIntegrationApp } from './support/test-app';

interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
interface AttributeItem {
  id: string;
  name: string;
  displayName: string;
  scope: string;
  editable: boolean;
  displayOrder: number;
  selectOptions: string[];
  validationRules: { maxLength: number | null };
}

/**
 * v2 administration — plant configuration: custom attribute definitions (plant-owned plus shared ones,
 * server-side display order, values deleted with the definition), the retired dashboard settings (404),
 * organizations and plants (reach and super-administrator writes), branding.
 */
describe('v2 administration: attributes, hierarchy, branding', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: AdminWorld;
  let superAdmin: SeededUser;
  let adminA: SeededUser;
  let adminB: SeededUser;
  let operatorA: SeededUser;
  const http = () => request(app.getHttpServer());
  const key = () => ({ 'Idempotency-Key': randomUUID() });

  beforeAll(async () => {
    await harness.start();
    world = await seedAdminWorld(harness.dataSource);
    app = await createIntegrationApp(harness, { modules: [V2Module] });
    const ds = harness.dataSource;
    superAdmin = await seedUser(app, ds, {
      name: 'Sue Super',
      role: 'SuperAdmin',
      tenantId: world.plantA,
      organizationId: world.org1,
    });
    adminA = await seedUser(app, ds, {
      name: 'Ada Admin',
      role: 'TenantAdmin',
      tenantId: world.plantA,
      organizationId: world.org1,
    });
    adminB = await seedUser(app, ds, {
      name: 'Ben Admin',
      role: 'TenantAdmin',
      tenantId: world.plantB,
      organizationId: world.org1,
    });
    operatorA = await seedUser(app, ds, {
      name: 'Ole Operator',
      role: 'Operator',
      tenantId: world.plantA,
      organizationId: world.org1,
    });
    await ds.query(
      `INSERT INTO custom_attribute_definitions (id, entity_type, attribute_name, display_name, data_type, display_order)
       VALUES ($1, 'Unit', 'shared_code', 'Shared code', 'string', 5)`,
      [randomUUID()],
    );
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  it('creates plant attributes in display order next to the shared ones', async () => {
    const create = (body: Record<string, unknown>) =>
      http()
        .post('/api/v2/custom-attribute-definitions')
        .set(bearer(adminA.token))
        .set(key())
        .send(body);
    const first = await create({
      entityType: 'Unit',
      name: 'line_class',
      displayName: 'Line class',
      dataType: 'select',
      selectOptions: ['A', 'B'],
    }).expect(201);
    expect(bodyOf(first)).toMatchObject({
      scope: 'plant',
      editable: true,
      displayOrder: 0,
      selectOptions: ['A', 'B'],
    });
    const second = await create({
      entityType: 'Unit',
      name: 'room',
      displayName: 'Room',
      dataType: 'string',
      validationRules: { maxLength: 20 },
    }).expect(201);
    expect(bodyOf(second).displayOrder).toBe(1);
    expect(
      bodyOf(
        await create({
          entityType: 'Unit',
          name: 'room',
          displayName: 'Again',
          dataType: 'string',
        }).expect(409),
      ).code,
    ).toBe('ATTRIBUTE_EXISTS');
    await create({
      entityType: 'Unit',
      name: 'Bad Name',
      displayName: 'x',
      dataType: 'string',
    }).expect(422);

    const list = bodyOf<Page<AttributeItem>>(
      await http()
        .get('/api/v2/custom-attribute-definitions?entityType=Unit')
        .set(bearer(operatorA.token))
        .expect(200),
    );
    expect(list.items.map((a) => a.name)).toEqual([
      'line_class',
      'room',
      'shared_code',
    ]);
    expect(list.items[1].validationRules.maxLength).toBe(20);
    expect(list.items[0].editable).toBe(false);
    const shared = list.items[2];
    expect(shared.scope).toBe('global');
    expect(
      bodyOf(
        await http()
          .patch(`/api/v2/custom-attribute-definitions/${shared.id}`)
          .set(bearer(adminA.token))
          .send({ displayName: 'x' })
          .expect(403),
      ).code,
    ).toBe('ATTRIBUTE_NOT_EDITABLE');
    const plantB = bodyOf<Page<AttributeItem>>(
      await http()
        .get('/api/v2/custom-attribute-definitions')
        .set(bearer(adminB.token))
        .expect(200),
    );
    expect(plantB.items.map((a) => a.name)).toEqual(['shared_code']);

    await harness.dataSource.query(
      `INSERT INTO custom_attribute_values (id, tenant_id, entity_id, entity_type, attribute_definition_id, value) VALUES ($1, $2, $3, 'Unit', $4, 'A')`,
      [randomUUID(), world.plantA, world.unitA, bodyOf(first).id],
    );
    await http()
      .delete(`/api/v2/custom-attribute-definitions/${bodyOf(first).id}`)
      .set(bearer(adminA.token))
      .expect(204);
    const values: unknown[] = await harness.dataSource.query(
      'SELECT 1 FROM custom_attribute_values WHERE attribute_definition_id = $1',
      [bodyOf(first).id],
    );
    expect(values).toHaveLength(0);
  });

  it('no longer serves the retired dashboard settings (FE-02)', async () => {
    await http()
      .get('/api/v2/dashboard-configuration')
      .set(bearer(adminA.token))
      .expect(404);
    const tables: unknown[] = await harness.dataSource.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'dashboard_configurations'`,
    );
    expect(tables).toHaveLength(0);
  });

  it('lists organizations and plants within reach; only super administrators create and delete', async () => {
    const plants = bodyOf<Page<{ name: string; canDelete: boolean }>>(
      await http().get('/api/v2/tenants').set(bearer(adminA.token)).expect(200),
    );
    expect(plants.items.map((p) => p.name)).toEqual(['Plant A']);
    const all = bodyOf<Page<{ name: string }>>(
      await http()
        .get('/api/v2/tenants')
        .set(bearer(superAdmin.token))
        .expect(200),
    );
    expect(all.items.map((p) => p.name)).toEqual([
      'Plant A',
      'Plant B',
      'Plant C',
    ]);
    const orgs = bodyOf<Page<{ name: string }>>(
      await http()
        .get('/api/v2/organizations')
        .set(bearer(adminA.token))
        .expect(200),
    );
    expect(orgs.items.map((o) => o.name)).toEqual(['Org One']);

    await http()
      .post('/api/v2/organizations')
      .set(bearer(adminA.token))
      .set(key())
      .send({ code: 'X1', name: 'X' })
      .expect(403);
    const org = bodyOf(
      await http()
        .post('/api/v2/organizations')
        .set(bearer(superAdmin.token))
        .set(key())
        .send({ code: 'NEWORG', name: 'New Org' })
        .expect(201),
    );
    const plant = {
      code: 'NEWPLANT',
      name: 'New Plant',
      organizationId: org.id,
      timezone: 'Asia/Tehran',
    };
    expect(
      bodyOf(
        await http()
          .post('/api/v2/tenants')
          .set(bearer(superAdmin.token))
          .set(key())
          .send({ ...plant, timezone: 'Mars/Base' })
          .expect(422),
      ).code,
    ).toBe('INVALID_TIMEZONE');
    const created = bodyOf(
      await http()
        .post('/api/v2/tenants')
        .set(bearer(superAdmin.token))
        .set(key())
        .send(plant)
        .expect(201),
    );
    expect(created).toMatchObject({
      organizationName: 'New Org',
      timezone: 'Asia/Tehran',
      calendarSystem: 'gregorian',
      // DT-10: an Iranian plant's week starts on Saturday unless the creator says otherwise
      weekStart: 'saturday',
    });
    expect(
      bodyOf(
        await http()
          .delete(`/api/v2/organizations/${org.id}`)
          .set(bearer(superAdmin.token))
          .expect(409),
      ).code,
    ).toBe('ORGANIZATION_HAS_PLANTS');
    expect(
      bodyOf(
        await http()
          .delete(`/api/v2/tenants/${world.plantA}`)
          .set(bearer(superAdmin.token))
          .expect(422),
      ).code,
    ).toBe('PLANT_IN_USE');
    await http()
      .delete(`/api/v2/tenants/${created.id}`)
      .set(bearer(superAdmin.token))
      .expect(204);
    await http()
      .delete(`/api/v2/organizations/${org.id}`)
      .set(bearer(superAdmin.token))
      .expect(204);
  });

  it('v2 custom attribute values: plant members read, master-data writers set, other plants get 404', async () => {
    const definition = bodyOf<{ id: string }>(
      await http()
        .post('/api/v2/custom-attribute-definitions')
        .set(bearer(adminA.token))
        .set(key())
        .send({
          entityType: 'Unit',
          name: 'shelter',
          displayName: 'Shelter',
          dataType: 'string',
        })
        .expect(201),
    );
    const value = {
      entityType: 'Unit',
      entityId: world.unitA,
      attributeDefinitionId: definition.id,
      value: 'North hall',
    };
    await http()
      .put('/api/v2/custom-attribute-values')
      .set(bearer(operatorA.token))
      .send(value)
      .expect(403);
    await http()
      .put('/api/v2/custom-attribute-values')
      .set(bearer(adminA.token))
      .send(value)
      .expect(200);
    await http()
      .put('/api/v2/custom-attribute-values')
      .set(bearer(adminA.token))
      .send({ ...value, value: 'South hall' })
      .expect(200);
    const read = bodyOf<
      Array<{ attributeDefinitionId: string; value: string }>
    >(
      await http()
        .get(
          `/api/v2/custom-attribute-values?entityType=Unit&entityId=${world.unitA}`,
        )
        .set(bearer(operatorA.token))
        .expect(200),
    );
    expect(read).toEqual([
      expect.objectContaining({
        attributeDefinitionId: definition.id,
        value: 'South hall',
      }),
    ]);
    expect(
      bodyOf(
        await http()
          .put('/api/v2/custom-attribute-values')
          .set(bearer(adminA.token))
          .send({ ...value, entityType: 'Asset' })
          .expect(404),
      ).code,
    ).toBe('NOT_FOUND');
    await http()
      .get(
        `/api/v2/custom-attribute-values?entityType=Unit&entityId=${world.unitA}`,
      )
      .set(bearer(adminB.token))
      .expect(404);
  });

  it('changes the plant display settings for plant administrators only', async () => {
    const changed = bodyOf(
      await http()
        .patch(`/api/v2/tenants/${world.plantA}/display-settings`)
        .set(bearer(adminA.token))
        .send({ calendarSystem: 'persian' })
        .expect(200),
    );
    expect(changed.calendarSystem).toBe('persian');
    const week = bodyOf(
      await http()
        .patch(`/api/v2/tenants/${world.plantA}/display-settings`)
        .set(bearer(adminA.token))
        .send({ weekStart: 'saturday' })
        .expect(200),
    );
    expect(week).toMatchObject({
      weekStart: 'saturday',
      calendarSystem: 'persian',
    });
    await http()
      .patch(`/api/v2/tenants/${world.plantA}/display-settings`)
      .set(bearer(adminA.token))
      .send({ weekStart: 'someday' })
      .expect(422);
    await http()
      .patch(`/api/v2/tenants/${world.plantA}/display-settings`)
      .set(bearer(operatorA.token))
      .send({ digits: 'persian' })
      .expect(403);
    await http()
      .get(`/api/v2/tenants/${world.plantC}`)
      .set(bearer(adminA.token))
      .expect(404);
  });

  it('serves branding to everyone and lets only super administrators change it', async () => {
    const before = bodyOf(
      await http()
        .get('/api/v2/branding')
        .set(bearer(operatorA.token))
        .expect(200),
    );
    expect(before).toMatchObject({
      isStored: false,
      appName: 'Traverse Forge',
    });
    await http()
      .put('/api/v2/branding')
      .set(bearer(adminA.token))
      .send({ appName: 'Plant OS' })
      .expect(403);
    const saved = bodyOf(
      await http()
        .put('/api/v2/branding')
        .set(bearer(superAdmin.token))
        .send({ appName: 'Plant OS', primaryColor: '#112233' })
        .expect(200),
    );
    expect(saved).toMatchObject({
      isStored: true,
      appName: 'Plant OS',
      primaryColor: '#112233',
      logoSize: 32,
    });
    await http()
      .put('/api/v2/branding')
      .set(bearer(superAdmin.token))
      .send({ appName: 'X', logoUrl: 'javascript:alert(1)' })
      .expect(422);
    const reset = bodyOf(
      await http()
        .delete('/api/v2/branding')
        .set(bearer(superAdmin.token))
        .expect(200),
    );
    expect(reset.isStored).toBe(false);
  });

  it('settings audit 21 Oct 2026: public sign-in branding, clearable subtitle, no branding through v1', async () => {
    const saved = bodyOf(
      await http()
        .put('/api/v2/branding')
        .set(bearer(superAdmin.token))
        .send({ appName: 'Plant OS', appSubtitle: '', logoInitials: '' })
        .expect(200),
    );
    // cleared on purpose: the defaults do not come back
    expect(saved).toMatchObject({ appSubtitle: '', logoInitials: '' });
    const signIn = await http().get('/api/v2/branding/public').expect(200);
    expect(signIn.headers['cache-control']).toContain('max-age');
    expect(bodyOf(signIn)).toEqual({
      appName: 'Plant OS',
      appSubtitle: '',
      logoInitials: '',
      primaryColor: '#2563eb',
    });
    const refused = await http()
      .post('/api/app-settings/branding/value')
      .set(bearer(superAdmin.token))
      .send({
        value: { appName: 'Sneaky', primaryColor: 'url(https://x.test)' },
      })
      .expect(422);
    expect(refused.body).toMatchObject({ code: 'SETTING_V2_ONLY' });
    await http()
      .delete('/api/v2/branding')
      .set(bearer(superAdmin.token))
      .expect(200);
  });
});
