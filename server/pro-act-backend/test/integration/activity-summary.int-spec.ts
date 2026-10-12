import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

interface Count {
  key: string;
  count: number;
}

interface Summary {
  data: {
    timezone: string;
    rcaCases: {
      total: number;
      open: number;
      overdue: number;
      byStatus: Count[];
      createdByDay: Array<{ day: string; count: number }>;
    };
    tasks: {
      total: number;
      open: number;
      overdue: number;
      byPriority: Count[];
    };
    audit: { total: number; byAction: Count[] } | null;
  };
}

const FROM = '2027-04-01T00:00:00Z';
const TO = '2027-04-08T00:00:00Z';
const IN_WINDOW = '2027-04-02T10:00:00Z';
const OUTSIDE = '2027-03-20T10:00:00Z';

/**
 * Reports → Work summary (`GET /v2/reports/activity-summary`, the v1 RCA / task / audit summaries on v2):
 * counts in the window only, the tenant from identity (tenant B never sees A), RCA cases of a unit-limited
 * caller limited to its units, audit activity for audit readers only, `tenantId` in the query refused.
 */
describe('activity summary (Reports work summary)', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  const tokens = { managerA: '', viewerA: '', adminB: '', unitLimitedA: '' };
  const rows = (sql: string, params: unknown[]) =>
    harness.dataSource.query(sql, params);
  const read = (token: string, query = `from=${FROM}&to=${TO}`) =>
    request(app.getHttpServer())
      .get(`/api/v2/reports/activity-summary?${query}`)
      .set(bearer(token));

  async function seedRca(
    unitId: string | null,
    status: string,
    createdAt: string,
  ) {
    await rows(
      `INSERT INTO "rcas" ("title", "status", "priority", "tenant_id", "unit_id", "created_at", "target_completion_date")
       VALUES ('rca', $1, 'High', $2, $3, $4, '2020-01-03T00:00:00Z')`,
      [status, world.tenantA, unitId, createdAt],
    );
  }

  async function seedTask(
    tenantId: string,
    status: string,
    priority: string,
    createdAt: string,
  ) {
    await rows(
      `INSERT INTO "tasks" ("title", "assigned_to", "assigned_by", "priority", "status", "organization_id", "tenant_id", "due_date", "created_at")
       VALUES ('task', 'u', 'u', $1, $2, $3, $4, '2020-01-03T00:00:00Z', $5)`,
      [priority, status, world.organizationId, tenantId, createdAt],
    );
  }

  async function unitLimitedUser(): Promise<string> {
    const userId = randomUUID();
    await rows(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id) VALUES ($1, 'op', $2, 'x', 'Operator', $3)`,
      [userId, `${userId}@test.local`, world.tenantA],
    );
    await rows(
      `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version) VALUES ($1, $2, 'unit', $3, 'operator', 1)`,
      [world.tenantA, userId, world.unitA1],
    );
    return signToken(app, {
      userId,
      tenantId: world.tenantA,
      role: 'Operator',
    });
  }

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, { modules: [V2Module] });
    const token = (tenantId: string, role: string) =>
      signToken(app, { userId: randomUUID(), tenantId, role });
    tokens.managerA = token(world.tenantA, 'TenantAdmin');
    tokens.viewerA = token(world.tenantA, 'viewer');
    tokens.adminB = token(world.tenantB, 'TenantAdmin');
    tokens.unitLimitedA = await unitLimitedUser();
    await seedRca(world.unitA1, 'Draft', IN_WINDOW);
    await seedRca(world.unitA2, 'Closed', IN_WINDOW);
    await seedRca(world.unitA1, 'Draft', OUTSIDE);
    await seedTask(world.tenantA, 'Open', 'High', IN_WINDOW);
    await seedTask(world.tenantA, 'Completed', 'Low', IN_WINDOW);
    await seedTask(world.tenantB, 'Open', 'High', IN_WINDOW);
    await rows(
      `INSERT INTO "audit_logs" ("user_id", "action", "entity_type", "entity_id", "tenant_id", "timestamp", "created_at")
       VALUES ($1, 'UPDATE', 'Task', 'x', $2, $3, $3), ($1, 'UPDATE', 'Task', 'y', $2, $3, $3), ($1, 'CREATE', 'Task', 'z', $4, $3, $3)`,
      [randomUUID(), world.tenantA, IN_WINDOW, world.tenantB],
    );
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  it('counts the work items and audit entries the tenant created in the window', async () => {
    const body = (await read(tokens.managerA).expect(200)).body as Summary;
    expect(body.data.rcaCases).toMatchObject({ total: 2, open: 1, overdue: 1 });
    expect(body.data.rcaCases.byStatus).toEqual([
      { key: 'Closed', count: 1 },
      { key: 'Draft', count: 1 },
    ]);
    expect(body.data.rcaCases.createdByDay).toEqual([
      { day: '2027-04-02', count: 2 },
    ]);
    expect(body.data.tasks).toMatchObject({ total: 2, open: 1, overdue: 1 });
    expect(body.data.audit).toMatchObject({
      total: 2,
      byAction: [{ key: 'UPDATE', count: 2 }],
    });
  });

  it('keeps tenants apart and hides audit activity from non-readers', async () => {
    const other = (await read(tokens.adminB).expect(200)).body as Summary;
    expect(other.data.rcaCases.total).toBe(0);
    expect(other.data.tasks.total).toBe(1);
    expect(other.data.audit?.total).toBe(1);
    const viewer = (await read(tokens.viewerA).expect(200)).body as Summary;
    expect(viewer.data.audit).toBeNull();
    expect(viewer.data.tasks.total).toBe(2);
  });

  it('limits RCA cases of a unit-limited caller to its units', async () => {
    const limited = (await read(tokens.unitLimitedA).expect(200))
      .body as Summary;
    expect(limited.data.rcaCases.total).toBe(1);
    expect(limited.data.audit).toBeNull();
  });

  it('refuses a tenantId in the query, a reversed window and unknown parameters', async () => {
    await read(
      tokens.managerA,
      `from=${FROM}&to=${TO}&tenantId=${world.tenantB}`,
    ).expect(400);
    await read(tokens.managerA, `from=${TO}&to=${FROM}`).expect(422);
    await read(tokens.managerA, `from=${FROM}&to=${TO}&units=x`).expect(422);
    await request(app.getHttpServer())
      .get(`/api/v2/reports/activity-summary?from=${FROM}&to=${TO}`)
      .expect(401);
  });
});
