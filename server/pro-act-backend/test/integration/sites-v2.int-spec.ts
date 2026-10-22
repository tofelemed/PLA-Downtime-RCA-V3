import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import {
  AdminWorld,
  bodyOf,
  SeededUser,
  seedAdminWorld,
  seedUser,
} from './support/admin-world';
import { bearer, createIntegrationApp } from './support/test-app';

interface Page<T> {
  items: T[];
  nextCursor: string | null;
  scope: { tenantId: string };
}
interface SiteItem {
  id: string;
  name: string;
  timezone: string;
  operationalDayStart: string;
  isDefault: boolean;
  unitCount: number;
}
interface UnitItem {
  id: string;
  siteId: string | null;
  siteName: string | null;
}

/**
 * Setup UX Phase 1 (DECISIONS 2026-10-22): a plant is created with its default site and, for an organization
 * administrator, a grant that lets it switch to the plant; sites are listed, created and renamed per plant;
 * units carry a site of their plant. Row-level security is on, as in production.
 */
describe('v2 sites and plant provisioning', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: AdminWorld;
  let orgAdmin: SeededUser;
  let adminA: SeededUser;
  let adminB: SeededUser;
  let operatorA: SeededUser;
  const http = () => request(app.getHttpServer());
  const key = () => ({ 'Idempotency-Key': randomUUID() });

  beforeAll(async () => {
    await harness.start();
    world = await seedAdminWorld(harness.dataSource);
    app = await createIntegrationApp(harness, {
      modules: [V2Module],
      rlsBinding: true,
    });
    const ds = harness.dataSource;
    const seed = (name: string, role: string, tenantId: string) =>
      seedUser(app, ds, { name, role, tenantId, organizationId: world.org1 });
    orgAdmin = await seed('Olga Org', 'OrgAdmin', world.plantA);
    adminA = await seed('Ada Admin', 'TenantAdmin', world.plantA);
    adminB = await seed('Ben Admin', 'TenantAdmin', world.plantB);
    operatorA = await seed('Ole Operator', 'Operator', world.plantA);
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  const sitesOf = async (token: string, tenantId?: string) =>
    bodyOf<Page<SiteItem>>(
      await http()
        .get('/api/v2/sites?sort=name')
        .set(bearer(token))
        .set(tenantId ? { 'X-Tenant-Id': tenantId } : {})
        .expect(200),
    );

  it('an organization administrator creates a plant, can switch to it and finds its default site', async () => {
    const created = bodyOf(
      await http()
        .post('/api/v2/tenants')
        .set(bearer(orgAdmin.token))
        .set(key())
        .send({
          code: `NEW-${randomUUID().slice(0, 6)}`,
          name: 'New Plant',
          organizationId: world.org1,
          timezone: 'Asia/Tehran',
        })
        .expect(201),
    );
    const page = await sitesOf(orgAdmin.token, created.id);
    expect(page.scope.tenantId).toBe(created.id);
    expect(page.items).toEqual([
      expect.objectContaining({
        name: 'New Plant',
        timezone: 'Asia/Tehran',
        timezoneFallback: false,
        operationalDayStart: '06:00',
        isDefault: true,
        unitCount: 0,
      }),
    ]);
    const grants = await harness.dataSource.query<Array<{ role: string }>>(
      `SELECT role FROM user_scopes WHERE user_id = $1 AND tenant_id = $2 AND scope_kind = 'tenant'`,
      [orgAdmin.id, created.id],
    );
    expect(grants).toEqual([]); // reached by organization, no role granted (DECISIONS 2026-10-22)
  });

  it('plant administrators create and rename sites; names are unique per plant; readers only read', async () => {
    const north = bodyOf<SiteItem>(
      await http()
        .post('/api/v2/sites')
        .set(bearer(adminA.token))
        .set(key())
        .send({ name: ' North ', operationalDayStart: '07:00' })
        .expect(201),
    );
    expect(north).toMatchObject({
      name: 'North',
      isDefault: false,
      operationalDayStart: '07:00',
      unitCount: 0,
    });
    const duplicate = bodyOf(
      await http()
        .post('/api/v2/sites')
        .set(bearer(adminA.token))
        .set(key())
        .send({ name: 'north' })
        .expect(409),
    );
    expect(duplicate.code).toBe('SITE_NAME_EXISTS');
    await http()
      .post('/api/v2/sites')
      .set(bearer(operatorA.token))
      .set(key())
      .send({ name: 'Nope' })
      .expect(403);
    const renamed = bodyOf<SiteItem>(
      await http()
        .patch(`/api/v2/sites/${north.id}`)
        .set(bearer(adminA.token))
        .send({ name: 'North yard' })
        .expect(200),
    );
    expect(renamed.name).toBe('North yard');
    await http()
      .patch(`/api/v2/sites/${north.id}`)
      .set(bearer(adminB.token))
      .send({ name: 'Stolen' })
      .expect(404);
    const names = (await sitesOf(operatorA.token)).items.map((s) => s.name);
    expect(names).toEqual(['North yard', 'Plant A']);
  });

  it('units take a site of their plant and show its name; foreign sites are 422 SITE_NOT_IN_PLANT', async () => {
    const sitesA = (await sitesOf(adminA.token)).items;
    const north = sitesA.find((s) => !s.isDefault);
    const foreign = (await sitesOf(adminB.token)).items[0];
    const createUnit = (body: Record<string, unknown>) =>
      http()
        .post('/api/v2/units')
        .set(bearer(adminA.token))
        .set(key())
        .send({ name: 'Unit', ...body });
    const onNorth = bodyOf<UnitItem>(
      await createUnit({ code: 'S-1', siteId: north?.id }).expect(201),
    );
    expect(onNorth).toMatchObject({
      siteId: north?.id,
      siteName: 'North yard',
    });
    const onDefault = bodyOf<UnitItem>(
      await createUnit({ code: 'S-2' }).expect(201),
    );
    expect(onDefault).toMatchObject({ siteId: null, siteName: 'Plant A' });
    const refused = bodyOf(
      await createUnit({ code: 'S-3', siteId: foreign.id }).expect(422),
    );
    expect(refused.code).toBe('SITE_NOT_IN_PLANT');

    const moved = await http()
      .patch(`/api/v2/units/${onDefault.id}`)
      .set(bearer(adminA.token))
      .set('If-Match', '"1"')
      .send({ siteId: north?.id })
      .expect(200);
    expect(bodyOf<UnitItem>(moved).siteName).toBe('North yard');
    const counts = (await sitesOf(adminA.token)).items.map((s) => [
      s.name,
      s.unitCount,
    ]);
    expect(counts).toEqual([
      ['North yard', 2],
      // the seeded Line A1 has no site: it belongs to the default site
      ['Plant A', 1],
    ]);
    const list = bodyOf<Page<UnitItem>>(
      await http().get('/api/v2/units').set(bearer(adminA.token)).expect(200),
    );
    expect(
      Object.fromEntries(list.items.map((u) => [u.id, u.siteName])),
    ).toEqual({
      [world.unitA]: 'Plant A',
      [onNorth.id]: 'North yard',
      [onDefault.id]: 'North yard',
    });
  });
});
