import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { OrganizationModule } from '../../src/organization/organization.module';
import { RolesModule } from '../../src/roles/roles.module';
import { TenantModule } from '../../src/tenant/tenant.module';
import { UnitModule } from '../../src/unit/unit.module';
import { UsersModule } from '../../src/users/users.module';
import { IntegrationHarness } from './harness';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

interface ErrorBody {
  code: string;
}

/**
 * v1 administration routes (persona defects ADM-10a, ADM-02b): `/users` and `/roles` are for
 * administrators and approvers, `/tenants` and `/organizations` list only what the caller may see
 * and are written by SuperAdmin / the OrgAdmin of the organization, master-data writes need
 * `master_data_admin` or `manager_approver`, and no user response carries `passwordHash`.
 */
describe('v1 administration access', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let otherOrganizationId: string;

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    otherOrganizationId = randomUUID();
    await harness.dataSource.query(
      `INSERT INTO organizations (id, code, name, is_active) VALUES ($1, $2, 'Other org', true)`,
      [otherOrganizationId, `OTHER-${otherOrganizationId.slice(0, 8)}`],
    );
    app = await createIntegrationApp(harness, {
      modules: [
        UsersModule,
        TenantModule,
        OrganizationModule,
        RolesModule,
        UnitModule,
      ],
    });
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  /** A user of tenant A with a tenant-wide scope role; returns its access token. */
  async function member(
    legacyRole: string,
    scopeRole: string,
    tenantId = world.tenantA,
  ): Promise<{ id: string; token: string }> {
    const id = randomUUID();
    await harness.dataSource.query(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id, organization_id)
       VALUES ($1, $2, $3, 'x', $4, $5, $6)`,
      [
        id,
        `user-${id.slice(0, 8)}`,
        `${id}@test.local`,
        legacyRole,
        tenantId,
        world.organizationId,
      ],
    );
    await harness.dataSource.query(
      `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version)
       VALUES ($1, $2, 'tenant', $1, $3, 1)`,
      [tenantId, id, scopeRole],
    );
    const token = signToken(app, {
      userId: id,
      tenantId,
      organizationId: world.organizationId,
      role: legacyRole,
    });
    return { id, token };
  }

  const hasPasswordHash = (body: unknown): boolean =>
    JSON.stringify(body).includes('passwordHash');

  describe('/users', () => {
    it('refuses an Operator the list and the create, but gives it the assignable list', async () => {
      const operator = await member('Operator', 'operator');
      const list = await http()
        .get('/api/users')
        .set(bearer(operator.token))
        .expect(403);
      expect((list.body as ErrorBody).code).toBe('FORBIDDEN_ROLE');
      const create = await http()
        .post('/api/users')
        .set(bearer(operator.token))
        .send({})
        .expect(403);
      expect((create.body as ErrorBody).code).toBe('FORBIDDEN_ROLE');

      const assignable = await http()
        .get('/api/users/assignable')
        .set(bearer(operator.token))
        .expect(200);
      const rows = assignable.body as Array<Record<string, unknown>>;
      expect(rows.some((row) => row.id === operator.id)).toBe(true);
      expect(
        rows.every((row) => Object.keys(row).sort().join() === 'id,name'),
      ).toBe(true);
    });

    it('lets a TenantAdmin list, create, read and update users without ever seeing passwordHash', async () => {
      const admin = await member('TenantAdmin', 'manager_approver');
      const list = await http()
        .get('/api/users')
        .set(bearer(admin.token))
        .expect(200);
      expect((list.body as unknown[]).length).toBeGreaterThan(0);
      expect(hasPasswordHash(list.body)).toBe(false);

      const email = `${randomUUID()}@test.local`;
      const created = await http()
        .post('/api/users')
        .set(bearer(admin.token))
        .send({
          name: 'New operator',
          email,
          password: 'Secret123!',
          role: 'Operator',
        })
        .expect(201);
      expect(hasPasswordHash(created.body)).toBe(false);
      expect(created.body).toMatchObject({ email, tenantId: world.tenantA });
      const id = (created.body as { id: string }).id;

      const one = await http()
        .get(`/api/users/${id}`)
        .set(bearer(admin.token))
        .expect(200);
      expect(hasPasswordHash(one.body)).toBe(false);
      const updated = await http()
        .put(`/api/users/${id}`)
        .set(bearer(admin.token))
        .send({ name: 'Renamed', password: 'Another123!' })
        .expect(200);
      expect(hasPasswordHash(updated.body)).toBe(false);
      expect(updated.body).toMatchObject({ name: 'Renamed' });
    });

    it('refuses a TenantAdmin SuperAdmin on both write routes, even while registration is public', async () => {
      const admin = await member('TenantAdmin', 'manager_approver');
      const attempt = () => ({
        name: 'Rogue',
        email: `${randomUUID()}@test.local`,
        password: 'Secret123!',
        role: 'SuperAdmin',
        tenantId: world.tenantA,
        organizationId: world.organizationId,
      });
      const viaUsers = await http()
        .post('/api/users')
        .set(bearer(admin.token))
        .send(attempt())
        .expect(403);
      expect((viaUsers.body as ErrorBody).code).toBe('ROLE_GRANT_NOT_ALLOWED');
      const previous = process.env.AUTH_ALLOW_PUBLIC_REGISTRATION;
      process.env.AUTH_ALLOW_PUBLIC_REGISTRATION = 'true';
      try {
        // the bearer token is honoured on the conditionally public route: rank rules apply
        const viaRegister = await http()
          .post('/api/auth/register')
          .set(bearer(admin.token))
          .send(attempt())
          .expect(403);
        expect((viaRegister.body as ErrorBody).code).toBe(
          'ROLE_GRANT_NOT_ALLOWED',
        );
        const operator = await member('Operator', 'operator');
        await http()
          .post('/api/auth/register')
          .set(bearer(operator.token))
          .send(attempt())
          .expect(403);
        await http()
          .post('/api/auth/register')
          .set(bearer('not-a-token'))
          .send(attempt())
          .expect(401);
        // closed (the production default): anonymous registration is 401
        process.env.AUTH_ALLOW_PUBLIC_REGISTRATION = 'false';
        await http().post('/api/auth/register').send(attempt()).expect(401);
      } finally {
        if (previous === undefined)
          delete process.env.AUTH_ALLOW_PUBLIC_REGISTRATION;
        else process.env.AUTH_ALLOW_PUBLIC_REGISTRATION = previous;
      }
    });

    it('refuses a TenantAdmin a role above its own and a peer', async () => {
      const admin = await member('TenantAdmin', 'manager_approver');
      const above = await http()
        .post('/api/users')
        .set(bearer(admin.token))
        .send({
          name: 'x',
          email: `${randomUUID()}@test.local`,
          password: 'Secret123!',
          role: 'OrgAdmin',
        })
        .expect(403);
      expect((above.body as ErrorBody).code).toBe('ROLE_GRANT_NOT_ALLOWED');
      const peer = await member('TenantAdmin', 'manager_approver');
      const edit = await http()
        .put(`/api/users/${peer.id}`)
        .set(bearer(admin.token))
        .send({ name: 'x' })
        .expect(403);
      expect((edit.body as ErrorBody).code).toBe('ROLE_GRANT_NOT_ALLOWED');
      await http()
        .delete(`/api/users/${peer.id}`)
        .set(bearer(admin.token))
        .expect(403);
    });
  });

  describe('/tenants and /organizations', () => {
    it('lists only the member tenants and their organization for an Operator, refusing writes', async () => {
      const operator = await member('Operator', 'operator');
      const tenants = await http()
        .get('/api/tenants')
        .set(bearer(operator.token))
        .expect(200);
      expect((tenants.body as Array<{ id: string }>).map((t) => t.id)).toEqual([
        world.tenantA,
      ]);
      const foreign = await http()
        .get(`/api/tenants/${world.tenantB}`)
        .set(bearer(operator.token))
        .expect(200);
      expect(foreign.body).toEqual({});
      const organizations = await http()
        .get('/api/organizations')
        .set(bearer(operator.token))
        .expect(200);
      expect(
        (organizations.body as Array<{ id: string }>).map((o) => o.id),
      ).toEqual([world.organizationId]);
      await http()
        .post('/api/tenants')
        .set(bearer(operator.token))
        .send({})
        .expect(403);
      await http()
        .post('/api/organizations')
        .set(bearer(operator.token))
        .send({})
        .expect(403);
    });

    it('lists the whole organization for its OrgAdmin, who writes inside it only', async () => {
      const orgAdmin = await member('OrgAdmin', 'OrgAdmin');
      const tenants = await http()
        .get('/api/tenants')
        .set(bearer(orgAdmin.token))
        .expect(200);
      const ids = (tenants.body as Array<{ id: string }>).map((t) => t.id);
      expect(ids).toEqual(
        expect.arrayContaining([world.tenantA, world.tenantB]),
      );
      expect(
        ids.every((id) => [world.tenantA, world.tenantB].includes(id)),
      ).toBe(true);

      await http()
        .put(`/api/organizations/${world.organizationId}`)
        .set(bearer(orgAdmin.token))
        .send({ description: 'edited by its OrgAdmin' })
        .expect(200);
      await http()
        .put(`/api/organizations/${otherOrganizationId}`)
        .set(bearer(orgAdmin.token))
        .send({ description: 'x' })
        .expect(404);
      const foreignTenant = await http()
        .post('/api/tenants')
        .set(bearer(orgAdmin.token))
        .send({
          code: `T-${randomUUID().slice(0, 8)}`,
          name: 'Foreign',
          organizationId: otherOrganizationId,
        })
        .expect(403);
      expect((foreignTenant.body as ErrorBody).code).toBe(
        'ORGANIZATION_NOT_ALLOWED',
      );
      await http()
        .post('/api/organizations')
        .set(bearer(orgAdmin.token))
        .send({})
        .expect(403);
    });

    it('lists everything for a SuperAdmin', async () => {
      const superAdmin = await member('SuperAdmin', 'SuperAdmin');
      const organizations = await http()
        .get('/api/organizations')
        .set(bearer(superAdmin.token))
        .expect(200);
      const ids = (organizations.body as Array<{ id: string }>).map(
        (o) => o.id,
      );
      expect(ids).toEqual(
        expect.arrayContaining([world.organizationId, otherOrganizationId]),
      );
    });
  });

  describe('/roles and master data', () => {
    it('keeps the role catalogue to administrators and its writes to SuperAdmin', async () => {
      const operator = await member('Operator', 'operator');
      await http().get('/api/roles').set(bearer(operator.token)).expect(403);
      const admin = await member('TenantAdmin', 'manager_approver');
      await http().get('/api/roles').set(bearer(admin.token)).expect(200);
      const create = await http()
        .post('/api/roles')
        .set(bearer(admin.token))
        .send({})
        .expect(403);
      expect((create.body as ErrorBody).code).toBe('FORBIDDEN_ROLE');
    });

    it('lets master_data_admin and manager_approver write units, not a production engineer', async () => {
      const engineer = await member('Engineer', 'production_engineer');
      await http().get('/api/units').set(bearer(engineer.token)).expect(200);
      const refused = await http()
        .post('/api/units')
        .set(bearer(engineer.token))
        .send({
          name: 'x',
          code: `U-${randomUUID().slice(0, 8)}`,
          tenantId: world.tenantA,
        })
        .expect(403);
      expect((refused.body as ErrorBody).code).toBe('FORBIDDEN_ROLE');
      for (const [legacyRole, scopeRole] of [
        ['Analyst', 'master_data_admin'],
        ['TenantAdmin', 'manager_approver'],
      ]) {
        const writer = await member(legacyRole, scopeRole);
        await http()
          .post('/api/units')
          .set(bearer(writer.token))
          .send({
            name: 'Line',
            code: `U-${randomUUID().slice(0, 8)}`,
            tenantId: world.tenantA,
          })
          .expect(201);
      }
    });
  });
});
