import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { TaskModule } from '../../src/task/task.module';
import { IntegrationHarness } from './harness';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

interface ErrorBody {
  code: string;
}

interface TaskBody {
  id: string;
  tenantId: string;
}

/**
 * v1 tasks are bound to the acting tenant (`TenantBindingGuard`, persona defect viewer R2): a body or
 * query `tenantId` must be the tenant the request acts on (`X-Tenant-Id` or the token tenant), a
 * read may name a tenant within the caller's scopes, and a read-only caller is refused before that.
 */
describe('v1 tasks: tenant binding', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, { modules: [TaskModule] });
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  /** A user of tenant A (legacy role there) holding `scopes` elsewhere; returns id and token. */
  async function member(
    legacyRole: string,
    scopes: Array<{ tenantId: string; role: string }>,
  ): Promise<{ id: string; token: string }> {
    const id = randomUUID();
    await harness.dataSource.query(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id, organization_id)
       VALUES ($1, 'u', $2, 'x', $3, $4, $5)`,
      [id, `${id}@test.local`, legacyRole, world.tenantA, world.organizationId],
    );
    for (const scope of scopes) {
      await harness.dataSource.query(
        `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version)
         VALUES ($1, $2, 'tenant', $1, $3, 1)`,
        [scope.tenantId, id, scope.role],
      );
    }
    const token = signToken(app, {
      userId: id,
      tenantId: world.tenantA,
      organizationId: world.organizationId,
      role: legacyRole,
    });
    return { id, token };
  }

  const taskFor = (userId: string, tenantId?: string) => ({
    title: `task ${randomUUID().slice(0, 8)}`,
    assignedTo: userId,
    assignedBy: userId,
    priority: 'Medium',
    status: 'Open',
    organizationId: world.organizationId,
    ...(tenantId ? { tenantId } : {}),
  });

  const storedTitles = async (title: string): Promise<number> => {
    const rows: Array<{ count: number }> = await harness.dataSource.query(
      'SELECT count(*)::int AS count FROM tasks WHERE title = $1',
      [title],
    );
    return rows[0].count;
  };

  it('refuses an Operator a task that names another tenant with 403 TENANT_MISMATCH', async () => {
    const operator = await member('Operator', [
      { tenantId: world.tenantA, role: 'operator' },
    ]);
    const body = taskFor(operator.id, world.tenantB);
    const response = await http()
      .post('/api/tasks')
      .set(bearer(operator.token))
      .send(body)
      .expect(403);
    expect((response.body as ErrorBody).code).toBe('TENANT_MISMATCH');
    expect(await storedTitles(body.title)).toBe(0);
  });

  it('refuses a viewer of the selected plant with READ_ONLY_ROLE, and without the header with TENANT_MISMATCH', async () => {
    const viewer = await member('Operator', [
      { tenantId: world.tenantB, role: 'viewer' },
    ]);
    const body = taskFor(viewer.id, world.tenantB);
    const selected = await http()
      .post('/api/tasks')
      .set(bearer(viewer.token))
      .set('X-Tenant-Id', world.tenantB)
      .send(body)
      .expect(403);
    expect((selected.body as ErrorBody).code).toBe('READ_ONLY_ROLE');
    // the defect: a v1 client that does not name the acting plant used to write into tenant B as an Operator of A
    const unselected = await http()
      .post('/api/tasks')
      .set(bearer(viewer.token))
      .send(body)
      .expect(403);
    expect((unselected.body as ErrorBody).code).toBe('TENANT_MISMATCH');
    expect(await storedTitles(body.title)).toBe(0);
    // a read may still name the plant the viewer holds a scope in
    await http()
      .get(`/api/tasks?tenantId=${world.tenantB}`)
      .set(bearer(viewer.token))
      .expect(200);
  });

  it('creates in the acting tenant, with or without a tenantId in the body', async () => {
    const operator = await member('Operator', [
      { tenantId: world.tenantA, role: 'operator' },
    ]);
    const named = await http()
      .post('/api/tasks')
      .set(bearer(operator.token))
      .send(taskFor(operator.id, world.tenantA))
      .expect(201);
    expect((named.body as TaskBody).tenantId).toBe(world.tenantA);
    const filled = await http()
      .post('/api/tasks')
      .set(bearer(operator.token))
      .send(taskFor(operator.id))
      .expect(201);
    expect((filled.body as TaskBody).tenantId).toBe(world.tenantA);

    const moved = await http()
      .put(`/api/tasks/${(named.body as TaskBody).id}`)
      .set(bearer(operator.token))
      .send({ tenantId: world.tenantB })
      .expect(403);
    expect((moved.body as ErrorBody).code).toBe('TENANT_MISMATCH');
    const list = await http()
      .get(`/api/tasks?tenantId=${world.tenantB}`)
      .set(bearer(operator.token))
      .expect(403);
    expect((list.body as ErrorBody).code).toBe('TENANT_MISMATCH');
  });

  it('lets a SuperAdmin name any existing tenant', async () => {
    const admin = await member('SuperAdmin', []);
    const created = await http()
      .post('/api/tasks')
      .set(bearer(admin.token))
      .send(taskFor(admin.id, world.tenantB))
      .expect(201);
    expect((created.body as TaskBody).tenantId).toBe(world.tenantB);
    const unknown = await http()
      .post('/api/tasks')
      .set(bearer(admin.token))
      .send(taskFor(admin.id, randomUUID()))
      .expect(403);
    expect((unknown.body as ErrorBody).code).toBe('TENANT_MISMATCH');
  });
});
