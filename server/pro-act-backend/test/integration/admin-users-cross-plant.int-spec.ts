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

interface UserItem {
  id: string;
  name: string;
  tenantId: string | null;
  tenantName: string | null;
  manageable: boolean;
  accessManageable: boolean;
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
  lock: string | null;
}

const emailOf = (user: SeededUser) => `${user.id}@test.local`;

/**
 * Owner decision 2026-10-12 "Plant admin should see the users": a plant administrator lists, names and
 * manages the access of users granted into its plant from another plant (through the SECURITY DEFINER
 * directory of the `PlantUserDirectory` migration), finds a user of its own organization by exact e-mail to
 * grant a first role, and never changes such a user's profile. The functions refuse a tenant that the
 * session is not bound to.
 */
describe('v2 administration: users granted in from another plant', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: AdminWorld;
  let adminA: SeededUser;
  let operatorA: SeededUser;
  let grace: SeededUser;
  let bea: SeededUser;
  let carl: SeededUser;
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
    const seed = (name: string, role: string, tenantId: string, org: string) =>
      seedUser(app, ds, { name, role, tenantId, organizationId: org });
    adminA = await seed('Ann Admin', 'TenantAdmin', world.plantA, world.org1);
    operatorA = await seed(
      'Olga Operator',
      'Operator',
      world.plantA,
      world.org1,
    );
    grace = await seedUser(app, ds, {
      name: 'Grace Whitfield',
      role: 'Operator',
      tenantId: world.plantB,
      organizationId: world.org1,
      scopes: [{ tenantId: world.plantA, role: 'viewer' }],
    });
    bea = await seed('Bea Bystander', 'Operator', world.plantB, world.org1);
    carl = await seed('Carl Customer', 'Operator', world.plantC, world.org2);
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  const listUsers = async (token: string, query = '') =>
    bodyOf<Page<UserItem>>(
      await http().get(`/api/v2/users${query}`).set(bearer(token)).expect(200),
    );

  it('lists a grantee from another plant with name and home plant, but no other user of that plant', async () => {
    const page = await listUsers(adminA.token, '?limit=100');
    const names = page.items.map((user) => user.name);
    expect(names).toContain('Grace Whitfield');
    expect(names).not.toContain('Bea Bystander');
    expect(names).not.toContain('Carl Customer');
    const graceItem = page.items.find((user) => user.id === grace.id);
    expect(graceItem).toMatchObject({
      tenantId: world.plantB,
      tenantName: 'Plant B',
      manageable: false,
      accessManageable: true,
    });
    const own = page.items.find((user) => user.id === operatorA.id);
    expect(own).toMatchObject({ manageable: true, accessManageable: true });
    const search = await listUsers(adminA.token, '?q=whitfield');
    expect(search.items.map((user) => user.id)).toEqual([grace.id]);
  });

  it('names the grantee for any member and lets tasks be assigned to her', async () => {
    const names = bodyOf<Page<{ id: string; name: string }>>(
      await http()
        .get(`/api/v2/users/directory?ids=${grace.id}&ids=${bea.id}`)
        .set(bearer(operatorA.token))
        .expect(200),
    );
    expect(names.items).toEqual([
      { id: grace.id, name: 'Grace Whitfield', isActive: true },
    ]);
    const picker = bodyOf<Page<{ name: string }>>(
      await http()
        .get('/api/v2/users/directory')
        .set(bearer(operatorA.token))
        .expect(200),
    );
    expect(picker.items.map((user) => user.name)).toContain('Grace Whitfield');
    const task = await http()
      .post('/api/v2/tasks')
      .set(bearer(adminA.token))
      .set(key())
      .send({ title: 'Read the report', assigneeId: grace.id, priority: 'Low' })
      .expect(201);
    expect(bodyOf(task).assigneeName).toBe('Grace Whitfield');
    await http()
      .post('/api/v2/tasks')
      .set(bearer(adminA.token))
      .set(key())
      .send({ title: 'Not here', assigneeId: bea.id, priority: 'Low' })
      .expect(422);
  });

  it('shows the grantee but refuses profile, role, password and status changes (home plant only)', async () => {
    const one = bodyOf<UserItem>(
      await http()
        .get(`/api/v2/users/${grace.id}`)
        .set(bearer(adminA.token))
        .expect(200),
    );
    expect(one).toMatchObject({ name: 'Grace Whitfield', manageable: false });
    await http()
      .get(`/api/v2/users/${bea.id}`)
      .set(bearer(adminA.token))
      .expect(404);
    for (const patch of [
      { name: 'Renamed' },
      { role: 'Engineer' },
      { password: 'Secret-123' },
      { isActive: false },
    ]) {
      const refused = await http()
        .patch(`/api/v2/users/${grace.id}`)
        .set(bearer(adminA.token))
        .send(patch)
        .expect(403);
      expect(bodyOf(refused).code).toBe('HOME_PLANT_ONLY');
    }
    await http()
      .delete(`/api/v2/users/${grace.id}`)
      .set(bearer(adminA.token))
      .expect(403);
    const [row]: Array<{ name: string; role: string; is_active: boolean }> =
      await harness.dataSource.query(
        'SELECT name, role, is_active FROM users WHERE id = $1',
        [grace.id],
      );
    expect(row).toEqual({
      name: 'Grace Whitfield',
      role: 'Operator',
      is_active: true,
    });
  });

  it('grants and revokes the grantee’s roles in this plant only', async () => {
    const created = await http()
      .post('/api/v2/user-scopes')
      .set(bearer(adminA.token))
      .set(key())
      .send({ userId: grace.id, role: 'reliability_engineer' })
      .expect(201);
    expect(bodyOf(created)).toMatchObject({
      userName: 'Grace Whitfield',
      lock: null,
    });
    const scopes = bodyOf<Page<ScopeItem>>(
      await http()
        .get(`/api/v2/user-scopes?userId=${grace.id}`)
        .set(bearer(adminA.token))
        .expect(200),
    );
    expect(scopes.items.map((s) => [s.role, s.lock]).sort()).toEqual([
      ['reliability_engineer', null],
      ['viewer', null],
    ]);
    await http()
      .delete(`/api/v2/user-scopes/${bodyOf(created).id}`)
      .set(bearer(adminA.token))
      .expect(204);
    const home: Array<{ tenant_id: string }> = await harness.dataSource.query(
      'SELECT tenant_id FROM user_scopes WHERE user_id = $1 ORDER BY tenant_id',
      [grace.id],
    );
    expect(home.map((s) => s.tenant_id).sort()).toEqual(
      [world.plantA, world.plantB].sort(),
    );
  });

  it('finds a user of the same organization by exact e-mail only, and grants a first role by e-mail', async () => {
    const lookup = (token: string, email: string) =>
      http()
        .get(`/api/v2/users/lookup?email=${encodeURIComponent(email)}`)
        .set(bearer(token));
    const found = bodyOf<UserItem>(
      await lookup(adminA.token, emailOf(bea).toUpperCase()).expect(200),
    );
    expect(found).toMatchObject({
      id: bea.id,
      name: 'Bea Bystander',
      tenantName: 'Plant B',
      manageable: false,
    });
    await lookup(adminA.token, emailOf(carl)).expect(404);
    await lookup(adminA.token, 'bystander').expect(422);
    await lookup(operatorA.token, emailOf(bea)).expect(403);

    const grantByEmail = (email: string) =>
      http()
        .post('/api/v2/user-scopes')
        .set(bearer(adminA.token))
        .set(key())
        .send({ email, role: 'viewer' });
    await grantByEmail(emailOf(carl)).expect(404);
    const granted = await grantByEmail(emailOf(bea)).expect(201);
    expect(bodyOf(granted)).toMatchObject({
      userId: bea.id,
      userName: 'Bea Bystander',
    });
    const page = await listUsers(adminA.token, '?q=bystander');
    expect(page.items.map((user) => user.id)).toEqual([bea.id]);
    await http()
      .post('/api/v2/user-scopes')
      .set(bearer(adminA.token))
      .set(key())
      .send({ userId: bea.id, email: emailOf(bea), role: 'viewer' })
      .expect(422);
  });

  it('drops the grantee from the plant once the last grant there is revoked', async () => {
    const scopes = bodyOf<Page<ScopeItem>>(
      await http()
        .get(`/api/v2/user-scopes?userId=${grace.id}`)
        .set(bearer(adminA.token))
        .expect(200),
    );
    for (const scope of scopes.items) {
      await http()
        .delete(`/api/v2/user-scopes/${scope.id}`)
        .set(bearer(adminA.token))
        .expect(204);
    }
    const page = await listUsers(adminA.token, '?limit=100');
    expect(page.items.map((user) => user.id)).not.toContain(grace.id);
  });

  describe('the directory functions', () => {
    /** Runs `sql` as the API runs a restricted request: the RLS role bound to `tenantIds`. */
    async function asBound<T>(
      tenantIds: string,
      sql: string,
      params: unknown[],
    ): Promise<T> {
      const runner = harness.dataSource.createQueryRunner();
      await runner.connect();
      try {
        await runner.query(
          `SET ROLE proact_rls_user; SELECT set_config('app.tenant_ids', '${tenantIds}', false)`,
        );
        return (await runner.query(sql, params)) as T;
      } finally {
        await runner.query(
          `RESET ROLE; SELECT set_config('app.tenant_ids', '', false)`,
        );
        await runner.release();
      }
    }

    it('return only directory columns for the bound tenant', async () => {
      const rows = await asBound<Array<Record<string, unknown>>>(
        world.plantA,
        'SELECT * FROM app_plant_user_directory($1::uuid)',
        [world.plantA],
      );
      expect(rows.length).toBeGreaterThan(0);
      expect(Object.keys(rows[0]).sort()).toEqual(
        [
          'created_at',
          'email',
          'id',
          'is_active',
          'name',
          'organization_id',
          'role',
          'tenant_id',
          'updated_at',
        ].sort(),
      );
    });

    it('refuse a tenant the session is not bound to', async () => {
      await expect(
        asBound(
          world.plantA,
          'SELECT * FROM app_plant_user_directory($1::uuid)',
          [world.plantC],
        ),
      ).rejects.toThrow(/not bound to this session/);
      await expect(
        asBound(
          world.plantA,
          'SELECT * FROM app_organization_user_by_email($1::uuid, $2)',
          [world.plantC, emailOf(carl)],
        ),
      ).rejects.toThrow(/not bound to this session/);
    });

    it('keep the unchecked helpers out of reach of the API role', async () => {
      await expect(
        asBound(
          world.plantA,
          'SELECT * FROM app_plant_user_rows($1::uuid, NULL)',
          [world.plantC],
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(
        asBound(
          world.plantA,
          'SELECT * FROM app_organization_user_rows($1::uuid, $2)',
          [world.plantC, emailOf(carl)],
        ),
      ).rejects.toThrow(/permission denied/);
    });
  });
});
