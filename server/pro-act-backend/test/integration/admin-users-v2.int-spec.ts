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

interface UserItem {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
  tenantName: string | null;
  manageable: boolean;
  plantRoles: string[];
}
interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
interface ScopeItem {
  id: string;
  userId: string;
  userName: string | null;
  role: string;
  scopeName: string | null;
  lock: string | null;
}

/**
 * v2 administration — users, the user directory and scope grants (owner requirement "v2 only"): members
 * of the acting plant only, keyset pages, the grant policy (rank and reach), the home scope following a
 * role change, self protections, and scope-grant rules (no self grant, at most your rank, audited codes).
 */
describe('v2 administration: users and scope grants', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: AdminWorld;
  let superAdmin: SeededUser;
  let adminA: SeededUser;
  let adminB: SeededUser;
  let operatorA: SeededUser;
  let viewerA: SeededUser;
  const http = () => request(app.getHttpServer());
  const key = () => ({ 'Idempotency-Key': randomUUID() });

  beforeAll(async () => {
    await harness.start();
    world = await seedAdminWorld(harness.dataSource);
    app = await createIntegrationApp(harness, { modules: [V2Module] });
    const ds = harness.dataSource;
    superAdmin = await seedUser(app, ds, {
      name: 'Sam Super',
      role: 'SuperAdmin',
      tenantId: world.plantA,
      organizationId: world.org1,
    });
    adminA = await seedUser(app, ds, {
      name: 'Ann Admin',
      role: 'TenantAdmin',
      tenantId: world.plantA,
      organizationId: world.org1,
    });
    adminB = await seedUser(app, ds, {
      name: 'Bob Admin',
      role: 'TenantAdmin',
      tenantId: world.plantB,
      organizationId: world.org1,
    });
    operatorA = await seedUser(app, ds, {
      name: 'Olga Operator',
      role: 'Operator',
      tenantId: world.plantA,
      organizationId: world.org1,
    });
    viewerA = await seedUser(app, ds, {
      name: 'Vic Viewer',
      role: 'Operator',
      tenantId: world.plantA,
      organizationId: world.org1,
      isActive: false,
    });
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  const listUsers = async (token: string, query = '') =>
    (await http().get(`/api/v2/users${query}`).set(bearer(token)).expect(200))
      .body as Page<UserItem>;

  it('lists the members of the acting plant only, by name, with keyset pages', async () => {
    const first = await listUsers(adminA.token, '?limit=2');
    expect(first.items.map((u) => u.name)).toEqual([
      'Ann Admin',
      'Olga Operator',
    ]);
    expect(first.nextCursor).not.toBeNull();
    const second = await listUsers(
      adminA.token,
      `?limit=2&cursor=${encodeURIComponent(first.nextCursor ?? '')}`,
    );
    expect(second.items.map((u) => u.name)).toEqual([
      'Sam Super',
      'Vic Viewer',
    ]);
    const plantB = await listUsers(adminB.token);
    expect(plantB.items.map((u) => u.name)).toEqual(['Bob Admin']);
  });

  it('filters by text, role and active state and flags who the caller may manage', async () => {
    const operators = await listUsers(
      adminA.token,
      '?roles=Operator&isActive=true',
    );
    expect(operators.items.map((u) => u.name)).toEqual(['Olga Operator']);
    expect(operators.items[0].manageable).toBe(true);
    const inactive = await listUsers(adminA.token, '?isActive=false');
    expect(inactive.items.map((u) => u.name)).toEqual(['Vic Viewer']);
    const search = await listUsers(adminA.token, '?q=olga');
    expect(search.items).toHaveLength(1);
    const supers = await listUsers(adminA.token, '?q=Sam');
    expect(supers.items[0].manageable).toBe(false);
  });

  it('refuses the list to operators and the whole-installation reach to non-super administrators', async () => {
    await http().get('/api/v2/users').set(bearer(operatorA.token)).expect(403);
    await http()
      .get('/api/v2/users?reach=everyone')
      .set(bearer(adminA.token))
      .expect(403);
    const everyone = await listUsers(
      superAdmin.token,
      '?reach=everyone&limit=500',
    );
    expect(everyone.items.map((u) => u.name)).toContain('Bob Admin');
    await http()
      .get(`/api/v2/users?tenantId=${world.plantB}`)
      .set(bearer(adminA.token))
      .expect(400);
  });

  it('creates a plant user with its home scope, at most the caller rank, and refuses duplicates', async () => {
    const created = await http()
      .post('/api/v2/users')
      .set(bearer(adminA.token))
      .set(key())
      .send({
        name: 'New Engineer',
        email: 'new.engineer@test.local',
        password: 'Secret-123',
        role: 'Engineer',
      })
      .expect(201);
    expect(bodyOf(created)).toMatchObject({
      role: 'Engineer',
      tenantName: 'Plant A',
      isActive: true,
    });
    const scopes: Array<{ role: string }> = await harness.dataSource.query(
      'SELECT role FROM user_scopes WHERE user_id = $1',
      [bodyOf(created).id],
    );
    expect(scopes.map((s) => s.role)).toEqual(['production_engineer']);
    const refused = await http()
      .post('/api/v2/users')
      .set(bearer(adminA.token))
      .set(key())
      .send({
        name: 'Too High',
        email: 'too.high@test.local',
        password: 'Secret-123',
        role: 'OrgAdmin',
      })
      .expect(403);
    expect(bodyOf(refused).code).toBe('ROLE_GRANT_NOT_ALLOWED');
    const duplicate = await http()
      .post('/api/v2/users')
      .set(bearer(adminA.token))
      .set(key())
      .send({
        name: 'Again',
        email: 'NEW.engineer@test.local',
        password: 'Secret-123',
        role: 'Operator',
      })
      .expect(409);
    expect(bodyOf(duplicate).code).toBe('EMAIL_EXISTS');
  });

  it('moves the home scope with a role change and refuses peers and self deactivation', async () => {
    const operator = await seedUser(app, harness.dataSource, {
      name: 'Pat Promote',
      role: 'Operator',
      tenantId: world.plantA,
      organizationId: world.org1,
    });
    await http()
      .patch(`/api/v2/users/${operator.id}`)
      .set(bearer(adminA.token))
      .send({ role: 'Manager' })
      .expect(200);
    const scopes: Array<{ role: string }> = await harness.dataSource.query(
      'SELECT role FROM user_scopes WHERE user_id = $1',
      [operator.id],
    );
    expect(scopes.map((s) => s.role)).toEqual(['manager_approver']);
    const peer = await seedUser(app, harness.dataSource, {
      name: 'Peer Admin',
      role: 'TenantAdmin',
      tenantId: world.plantA,
      organizationId: world.org1,
    });
    const refused = await http()
      .patch(`/api/v2/users/${peer.id}`)
      .set(bearer(adminA.token))
      .send({ isActive: false })
      .expect(403);
    expect(bodyOf(refused).code).toBe('ROLE_GRANT_NOT_ALLOWED');
    const self = await http()
      .patch(`/api/v2/users/${superAdmin.id}`)
      .set(bearer(superAdmin.token))
      .send({ isActive: false })
      .expect(422);
    expect(bodyOf(self).code).toBe('CANNOT_DEACTIVATE_SELF');
    await http()
      .delete(`/api/v2/users/${adminB.id}`)
      .set(bearer(adminA.token))
      .expect(404);
  });

  it('resolves names of plant members (inactive too) and leaves out other plants', async () => {
    const body = bodyOf<Page<{ id: string; name: string; isActive: boolean }>>(
      await http()
        .get(`/api/v2/users/directory?ids=${viewerA.id}&ids=${adminB.id}`)
        .set(bearer(operatorA.token))
        .expect(200),
    );
    expect(body.items).toEqual([
      { id: viewerA.id, name: 'Vic Viewer', isActive: false },
    ]);
    const picker = bodyOf<Page<{ name: string }>>(
      await http()
        .get('/api/v2/users/directory')
        .set(bearer(operatorA.token))
        .expect(200),
    );
    expect(picker.items.map((u) => u.name)).not.toContain('Vic Viewer');
    expect(picker.items.map((u) => u.name)).toContain('Olga Operator');
  });

  it('grants and revokes scope roles under the rank and separation rules', async () => {
    const grant = (token: string, body: Record<string, unknown>) =>
      http()
        .post('/api/v2/user-scopes')
        .set(bearer(token))
        .set(key())
        .send(body);
    const created = await grant(adminA.token, {
      userId: operatorA.id,
      role: 'reliability_engineer',
      unitId: world.unitA,
    }).expect(201);
    expect(bodyOf(created)).toMatchObject({
      userName: 'Olga Operator',
      scopeName: 'Line A1',
      lock: null,
    });
    expect(
      bodyOf(
        await grant(adminA.token, {
          userId: operatorA.id,
          role: 'reliability_engineer',
          unitId: world.unitA,
        }).expect(409),
      ).code,
    ).toBe('SCOPE_EXISTS');
    expect(
      bodyOf(
        await grant(adminA.token, { userId: adminA.id, role: 'viewer' }).expect(
          403,
        ),
      ).code,
    ).toBe('SELF_GRANT_NOT_ALLOWED');
    expect(
      bodyOf(
        await grant(adminA.token, {
          userId: viewerA.id,
          role: 'viewer',
        }).expect(422),
      ).code,
    ).toBe('USER_INACTIVE');
    expect(
      bodyOf(
        await grant(adminA.token, {
          userId: operatorA.id,
          role: 'viewer',
          unitId: randomUUID(),
        }).expect(422),
      ).code,
    ).toBe('INVALID_REFERENCE');
    await grant(operatorA.token, { userId: viewerA.id, role: 'viewer' }).expect(
      403,
    );

    const list = bodyOf<Page<ScopeItem>>(
      await http()
        .get(`/api/v2/user-scopes?userId=${operatorA.id}`)
        .set(bearer(adminA.token))
        .expect(200),
    );
    const home = list.items.find((s) => s.role === 'operator');
    expect(home?.lock).toBe('home_role');
    expect(
      bodyOf(
        await http()
          .delete(`/api/v2/user-scopes/${home?.id}`)
          .set(bearer(adminA.token))
          .expect(422),
      ).code,
    ).toBe('HOME_SCOPE_REQUIRED');
    await http()
      .delete(`/api/v2/user-scopes/${bodyOf(created).id}`)
      .set(bearer(adminB.token))
      .expect(404);
    await http()
      .delete(`/api/v2/user-scopes/${bodyOf(created).id}`)
      .set(bearer(adminA.token))
      .expect(204);
  });

  it('guide roles only: the mirror goes once a plant-wide role is held, and the legacy mapping does not return (QA audit 2026-10-19)', async () => {
    const analyst = await seedUser(app, harness.dataSource, {
      name: 'Kim Finance',
      role: 'Analyst',
      tenantId: world.plantA,
      organizationId: world.org1,
    });
    const scopesOf = async () =>
      bodyOf<Page<ScopeItem>>(
        await http()
          .get(`/api/v2/user-scopes?userId=${analyst.id}`)
          .set(bearer(adminA.token))
          .expect(200),
      ).items;
    expect((await scopesOf()).map((s) => s.lock)).toEqual(['home_role']);
    await http()
      .post('/api/v2/user-scopes')
      .set(bearer(adminA.token))
      .set(key())
      .send({ userId: analyst.id, role: 'finance_approver' })
      .expect(201);
    const mirror = (await scopesOf()).find(
      (s) => s.role === 'production_engineer',
    );
    expect(mirror?.lock).toBeNull();
    await http()
      .delete(`/api/v2/user-scopes/${mirror?.id}`)
      .set(bearer(adminA.token))
      .expect(204);
    expect((await scopesOf()).map((s) => s.role)).toEqual(['finance_approver']);
    const listed = await listUsers(adminA.token, '?q=Kim');
    expect(listed.items[0]).toMatchObject({
      role: 'Analyst',
      plantRoles: ['finance_approver'],
    });
    const holders: Array<{ id: string }> = await harness.dataSource.query(
      `SELECT u."id" FROM "users" u WHERE u."id" = $1 AND u."tenant_id" = $2 AND u."role" = 'Analyst'
          AND NOT EXISTS (SELECT 1 FROM "user_scopes" own WHERE own."user_id" = u."id" AND own."tenant_id" = $2)`,
      [analyst.id, world.plantA],
    );
    expect(holders).toEqual([]);
  });

  it('lists the roles the caller may give', async () => {
    const body = bodyOf<{ roles: string[]; scopeRoles: string[] }>(
      await http()
        .get('/api/v2/users/grantable-roles')
        .set(bearer(adminA.token))
        .expect(200),
    );
    expect(body.roles).toContain('TenantAdmin');
    expect(body.roles).not.toContain('OrgAdmin');
    expect(body.scopeRoles).toContain('viewer');
  });
});
