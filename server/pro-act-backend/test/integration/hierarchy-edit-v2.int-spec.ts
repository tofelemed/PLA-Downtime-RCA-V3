import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { mapLegacyRole } from '../../src/auth/roles/role-model';
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

interface Editable {
  id: string;
  code: string;
  name: string;
  description: string | null;
  rowVersion: number;
  canEdit: boolean;
}
interface PlantDetail extends Editable {
  timezone: string | null;
  timezoneEditable: boolean;
  timezoneLockedReason: string | null;
}

/**
 * Organization / plant editing (DECISIONS 2026-10-19): who may edit, If-Match row versions, immutable
 * codes, and the plant time zone lock (events, samples, calculated periods) — also for an organization
 * administrator without a scope in the plant (row-level security must not hide the plant's data).
 */
describe('v2 hierarchy editing: organizations and plants', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: AdminWorld;
  let superAdmin: SeededUser;
  let orgAdmin: SeededUser;
  let tenantAdmin: SeededUser;
  const http = () => request(app.getHttpServer());
  const ifMatch = (version: number) => ({ 'If-Match': `"${version}"` });

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
    // administers Org One (plants A and B) from plant A; also an operator in Org Two's plant C
    orgAdmin = await seedUser(app, ds, {
      name: 'Olga OrgAdmin',
      role: 'OrgAdmin',
      tenantId: world.plantA,
      organizationId: world.org1,
      scopes: [{ tenantId: world.plantC, role: mapLegacyRole('Operator') }],
    });
    tenantAdmin = await seedUser(app, ds, {
      name: 'Ada Admin',
      role: 'TenantAdmin',
      tenantId: world.plantA,
      organizationId: world.org1,
    });
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  const getPlant = async (id: string, token: string) =>
    bodyOf<PlantDetail>(
      await http().get(`/api/v2/tenants/${id}`).set(bearer(token)).expect(200),
    );

  it('renames an organization under If-Match; the code never changes', async () => {
    const read = await http()
      .get(`/api/v2/organizations/${world.org1}`)
      .set(bearer(orgAdmin.token))
      .expect(200);
    const org = bodyOf<Editable>(read);
    expect(org).toMatchObject({ name: 'Org One', canEdit: true });
    expect(read.headers.etag).toBe(`"${org.rowVersion}"`);

    await http()
      .patch(`/api/v2/organizations/${world.org1}`)
      .set(bearer(orgAdmin.token))
      .send({ name: 'Org 1' })
      .expect(428);
    const coded = await http()
      .patch(`/api/v2/organizations/${world.org1}`)
      .set(bearer(orgAdmin.token))
      .set(ifMatch(org.rowVersion))
      .send({ name: 'Org 1', code: 'NEW-CODE' })
      .expect(422);
    // v2 answers class-validator refusals with 422 VALIDATION_FAILED; `code` is not a declared field
    expect(bodyOf(coded)).toMatchObject({
      code: 'VALIDATION_FAILED',
      fieldErrors: [expect.objectContaining({ field: 'code' })],
    });
    const blank = await http()
      .patch(`/api/v2/organizations/${world.org1}`)
      .set(bearer(orgAdmin.token))
      .set(ifMatch(org.rowVersion))
      .send({ name: '   ' })
      .expect(422);
    expect(bodyOf(blank).code).toBe('VALIDATION_FAILED');

    const saved = bodyOf<Editable>(
      await http()
        .patch(`/api/v2/organizations/${world.org1}`)
        .set(bearer(orgAdmin.token))
        .set(ifMatch(org.rowVersion))
        .send({ name: '  Org 1  ', description: 'Polymers' })
        .expect(200),
    );
    expect(saved).toMatchObject({
      name: 'Org 1',
      description: 'Polymers',
      code: org.code,
      rowVersion: org.rowVersion + 1,
    });
    const stale = await http()
      .patch(`/api/v2/organizations/${world.org1}`)
      .set(bearer(superAdmin.token))
      .set(ifMatch(org.rowVersion))
      .send({ description: '' })
      .expect(412);
    expect(bodyOf(stale).code).toBe('STALE_REVISION');
    const cleared = bodyOf<Editable>(
      await http()
        .patch(`/api/v2/organizations/${world.org1}`)
        .set(bearer(superAdmin.token))
        .set(ifMatch(saved.rowVersion))
        .send({ description: '' })
        .expect(200),
    );
    expect(cleared.description).toBeNull();
  });

  it('refuses other organizations to an organization administrator and everyone else', async () => {
    // Org Two is visible (scope in plant C) but not administered by this OrgAdmin
    const org2 = bodyOf<Editable>(
      await http()
        .get(`/api/v2/organizations/${world.org2}`)
        .set(bearer(orgAdmin.token))
        .expect(200),
    );
    expect(org2.canEdit).toBe(false);
    const refused = await http()
      .patch(`/api/v2/organizations/${world.org2}`)
      .set(bearer(orgAdmin.token))
      .set(ifMatch(org2.rowVersion))
      .send({ name: 'Mine now' })
      .expect(403);
    expect(bodyOf(refused).code).toBe('ORGANIZATION_NOT_ALLOWED');
    const plantC = await getPlant(world.plantC, orgAdmin.token);
    expect(plantC).toMatchObject({ canEdit: false, timezoneEditable: false });
    await http()
      .patch(`/api/v2/tenants/${world.plantC}`)
      .set(bearer(orgAdmin.token))
      .set(ifMatch(plantC.rowVersion))
      .send({ name: 'Mine now' })
      .expect(403);
    await http()
      .patch(`/api/v2/tenants/${world.plantA}`)
      .set(bearer(tenantAdmin.token))
      .set(ifMatch(1))
      .send({ name: 'Plant AA' })
      .expect(403);
    await http()
      .patch(`/api/v2/organizations/${world.org1}`)
      .set(bearer(tenantAdmin.token))
      .set(ifMatch(1))
      .send({ name: 'Org AA' })
      .expect(403);
  });

  it('edits a plant of the organization: name, description, time zone while unused; the default site follows', async () => {
    const plantB = await getPlant(world.plantB, orgAdmin.token);
    expect(plantB).toMatchObject({
      canEdit: true,
      timezoneEditable: true,
      timezoneLockedReason: null,
    });
    await harness.dataSource.query(
      `INSERT INTO sites (tenant_id, name, timezone, timezone_fallback, operational_day_start, is_default, row_version)
       VALUES ($1, 'Plant B', 'UTC', true, '06:00', true, 1)`,
      [world.plantB],
    );
    await http()
      .patch(`/api/v2/tenants/${world.plantB}`)
      .set(bearer(orgAdmin.token))
      .set(ifMatch(plantB.rowVersion))
      .send({ timezone: 'Mars/Base' })
      .expect(422);
    await http()
      .patch(`/api/v2/tenants/${world.plantB}`)
      .set(bearer(orgAdmin.token))
      .set(ifMatch(plantB.rowVersion))
      .send({ organizationId: world.org2 })
      .expect(422);
    const saved = bodyOf<PlantDetail>(
      await http()
        .patch(`/api/v2/tenants/${world.plantB}`)
        .set(bearer(orgAdmin.token))
        .set(ifMatch(plantB.rowVersion))
        .send({
          name: 'Plant Bravo',
          description: 'Second line',
          timezone: 'Asia/Tehran',
        })
        .expect(200),
    );
    expect(saved).toMatchObject({
      name: 'Plant Bravo',
      description: 'Second line',
      timezone: 'Asia/Tehran',
      code: plantB.code,
      rowVersion: plantB.rowVersion + 1,
      timezoneEditable: true,
    });
    const [site] = await harness.dataSource.query<
      Array<{ name: string; timezone: string; timezone_fallback: boolean }>
    >(
      `SELECT name, timezone, timezone_fallback FROM sites WHERE tenant_id = $1 AND is_default`,
      [world.plantB],
    );
    expect(site).toEqual({
      name: 'Plant Bravo',
      timezone: 'Asia/Tehran',
      timezone_fallback: false,
    });
  });

  it('locks the time zone once the plant has events, even for an organization administrator without a scope in it', async () => {
    const unitB = randomUUID();
    await harness.dataSource.query(
      `INSERT INTO units (id, code, name, tenant_id, organization_id) VALUES ($1, $2, 'Line B1', $3, $4)`,
      [unitB, `UB-${unitB.slice(0, 8)}`, world.plantB, world.org1],
    );
    await harness.dataSource.query(
      `INSERT INTO production_events (unit_id, start_time, end_time, tenant_id)
       VALUES ($1, '2030-01-01T00:00:00Z', '2030-01-01T01:00:00Z', $2)`,
      [unitB, world.plantB],
    );
    const plantB = await getPlant(world.plantB, orgAdmin.token);
    expect(plantB.timezoneEditable).toBe(false);
    expect(plantB.timezoneLockedReason).toContain('production events');
    const locked = await http()
      .patch(`/api/v2/tenants/${world.plantB}`)
      .set(bearer(orgAdmin.token))
      .set(ifMatch(plantB.rowVersion))
      .send({ timezone: 'Europe/Berlin' })
      .expect(409);
    expect(bodyOf(locked)).toMatchObject({
      code: 'TIMEZONE_LOCKED',
      details: {
        productionEvents: 1,
        signalSamples: 0,
        calculatedPeriods: 0,
      },
    });
    // the same zone and the other fields still save
    const renamed = bodyOf<PlantDetail>(
      await http()
        .patch(`/api/v2/tenants/${world.plantB}`)
        .set(bearer(orgAdmin.token))
        .set(ifMatch(plantB.rowVersion))
        .send({ name: 'Plant B', timezone: 'Asia/Tehran' })
        .expect(200),
    );
    expect(renamed).toMatchObject({
      name: 'Plant B',
      timezone: 'Asia/Tehran',
      rowVersion: plantB.rowVersion + 1,
    });
  });
});
