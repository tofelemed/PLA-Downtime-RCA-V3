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
interface TaskItem {
  id: string;
  title: string;
  status: string;
  assigneeName: string | null;
  assignedByName: string | null;
  overdue: boolean;
  completedAt: string | null;
  linkType: string | null;
}
interface AuditItem {
  id: string;
  action: string;
  actorName: string | null;
  message: string | null;
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * v2 administration — tasks and the audit trail: plant isolation, keyset pages, server-side filters,
 * counts computed on the server (summary), task commands (assignee membership, completion time), and the
 * audit readers, filters, counts and CSV export.
 */
describe('v2 administration: tasks and audit trail', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: AdminWorld;
  let manager: SeededUser;
  let operator: SeededUser;
  let otherPlant: SeededUser;
  const http = () => request(app.getHttpServer());
  const key = () => ({ 'Idempotency-Key': randomUUID() });

  beforeAll(async () => {
    await harness.start();
    world = await seedAdminWorld(harness.dataSource);
    app = await createIntegrationApp(harness, { modules: [V2Module] });
    const ds = harness.dataSource;
    manager = await seedUser(app, ds, {
      name: 'Mia Manager',
      role: 'Manager',
      tenantId: world.plantA,
      organizationId: world.org1,
    });
    operator = await seedUser(app, ds, {
      name: 'Otto Operator',
      role: 'Operator',
      tenantId: world.plantA,
      organizationId: world.org1,
    });
    otherPlant = await seedUser(app, ds, {
      name: 'Bea Other',
      role: 'TenantAdmin',
      tenantId: world.plantB,
      organizationId: world.org1,
    });
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  const createTask = (token: string, body: Record<string, unknown>) =>
    http().post('/api/v2/tasks').set(bearer(token)).set(key()).send(body);

  it('creates tasks with names resolved, sorts by due date and keeps plants apart', async () => {
    const past = new Date(Date.now() - DAY).toISOString();
    const future = new Date(Date.now() + DAY).toISOString();
    await createTask(operator.token, {
      title: 'Later',
      assigneeId: manager.id,
      priority: 'Low',
      dueDate: future,
    }).expect(201);
    const overdue = await createTask(manager.token, {
      title: 'Late',
      assigneeId: operator.id,
      priority: 'High',
      dueDate: past,
    }).expect(201);
    expect(bodyOf(overdue)).toMatchObject({
      assigneeName: 'Otto Operator',
      assignedByName: 'Mia Manager',
      overdue: true,
      status: 'Open',
    });
    await createTask(manager.token, {
      title: 'Undated',
      assigneeId: operator.id,
      priority: 'Medium',
    }).expect(201);
    await createTask(otherPlant.token, {
      title: 'Plant B task',
      assigneeId: otherPlant.id,
      priority: 'Low',
    }).expect(201);

    const list = bodyOf<Page<TaskItem>>(
      await http().get('/api/v2/tasks').set(bearer(operator.token)).expect(200),
    );
    expect(list.items.map((t) => t.title)).toEqual([
      'Late',
      'Later',
      'Undated',
    ]);
    const page1 = bodyOf<Page<TaskItem>>(
      await http()
        .get('/api/v2/tasks?limit=2')
        .set(bearer(operator.token))
        .expect(200),
    );
    const page2 = bodyOf<Page<TaskItem>>(
      await http()
        .get(
          `/api/v2/tasks?limit=2&cursor=${encodeURIComponent(page1.nextCursor ?? '')}`,
        )
        .set(bearer(operator.token))
        .expect(200),
    );
    expect([...page1.items, ...page2.items].map((t) => t.title)).toEqual([
      'Late',
      'Later',
      'Undated',
    ]);
    await http()
      .get(`/api/v2/tasks/${bodyOf(overdue).id}`)
      .set(bearer(otherPlant.token))
      .expect(404);
  });

  it('filters on the server and counts on the server', async () => {
    const mine = bodyOf<Page<TaskItem>>(
      await http()
        .get('/api/v2/tasks?assignedToMe=true')
        .set(bearer(operator.token))
        .expect(200),
    );
    expect(mine.items.map((t) => t.title).sort()).toEqual(['Late', 'Undated']);
    const late = bodyOf<Page<TaskItem>>(
      await http()
        .get('/api/v2/tasks?overdue=true')
        .set(bearer(operator.token))
        .expect(200),
    );
    expect(late.items.map((t) => t.title)).toEqual(['Late']);
    const summary = bodyOf(
      await http()
        .get('/api/v2/tasks/summary')
        .set(bearer(operator.token))
        .expect(200),
    );
    expect(summary).toMatchObject({
      total: 3,
      open: 3,
      inProgress: 0,
      completed: 0,
      overdue: 1,
    });
  });

  it('refuses assignees outside the plant and completes, reopens and deletes tasks', async () => {
    expect(
      bodyOf(
        await createTask(manager.token, {
          title: 'X',
          assigneeId: otherPlant.id,
          priority: 'Low',
        }).expect(422),
      ).code,
    ).toBe('INVALID_ASSIGNEE');
    const task = bodyOf<TaskItem>(
      await createTask(manager.token, {
        title: 'Fix seal',
        assigneeId: operator.id,
        priority: 'Critical',
        linkType: 'RCA',
        linkId: randomUUID(),
      }).expect(201),
    );
    const done = bodyOf<TaskItem>(
      await http()
        .post(`/api/v2/tasks/${task.id}/complete`)
        .set(bearer(operator.token))
        .set(key())
        .expect(200),
    );
    expect(done.status).toBe('Completed');
    expect(done.completedAt).not.toBeNull();
    const reopened = bodyOf<TaskItem>(
      await http()
        .patch(`/api/v2/tasks/${task.id}`)
        .set(bearer(operator.token))
        .send({ status: 'In Progress', linkType: null })
        .expect(200),
    );
    expect(reopened).toMatchObject({
      status: 'In Progress',
      completedAt: null,
      linkType: null,
    });
    await http()
      .delete(`/api/v2/tasks/${task.id}`)
      .set(bearer(otherPlant.token))
      .expect(404);
    await http()
      .delete(`/api/v2/tasks/${task.id}`)
      .set(bearer(manager.token))
      .expect(204);
  });

  async function audit(
    tenantId: string,
    userId: string,
    action: string,
    entityType: string,
    at: Date,
    details: string,
  ) {
    await harness.dataSource.query(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, organization_id, tenant_id, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        randomUUID(),
        userId,
        action,
        entityType,
        randomUUID(),
        details,
        world.org1,
        tenantId,
        at,
      ],
    );
  }

  it('reads the plant trail newest first with filters, counts and CSV, for audit readers only', async () => {
    const now = Date.now();
    await audit(
      world.plantA,
      operator.id,
      'CREATE',
      'Task',
      new Date(now - 3 * DAY),
      'CREATE Task "Pump"',
    );
    await audit(
      world.plantA,
      manager.id,
      'UPDATE',
      'User',
      new Date(now - 2 * DAY),
      JSON.stringify({ userName: 'Mia', message: 'Changed role' }),
    );
    await audit(
      world.plantA,
      randomUUID(),
      'DELETE',
      'Task',
      new Date(now - DAY),
      '=SUM(A1)',
    );
    await audit(
      world.plantB,
      otherPlant.id,
      'CREATE',
      'Task',
      new Date(now - DAY),
      'other plant',
    );

    const list = bodyOf<Page<AuditItem>>(
      await http()
        .get('/api/v2/audit-logs')
        .set(bearer(manager.token))
        .expect(200),
    );
    expect(list.items.map((e) => e.action)).toEqual([
      'DELETE',
      'UPDATE',
      'CREATE',
    ]);
    expect(list.items[1]).toMatchObject({
      actorName: 'Mia Manager',
      message: 'Changed role',
    });
    expect(list.items[0].actorName).toBeNull();
    const tasksOnly = bodyOf<Page<AuditItem>>(
      await http()
        .get('/api/v2/audit-logs?entityTypes=Task&q=pump')
        .set(bearer(manager.token))
        .expect(200),
    );
    expect(tasksOnly.items).toHaveLength(1);
    const from = new Date(now - 2.5 * DAY).toISOString();
    const summary = bodyOf(
      await http()
        .get(`/api/v2/audit-logs/summary?from=${from}`)
        .set(bearer(manager.token))
        .expect(200),
    );
    expect(summary.total).toBe(2);
    expect(summary.byAction).toEqual(
      expect.arrayContaining([
        { key: 'UPDATE', count: 1 },
        { key: 'DELETE', count: 1 },
      ]),
    );
    expect(summary.byDay).toHaveLength(2);
    await http()
      .get(`/api/v2/audit-logs?from=${from}&to=${from}`)
      .set(bearer(manager.token))
      .expect(422);

    const csv = await http()
      .get('/api/v2/audit-logs/export')
      .set(bearer(manager.token))
      .expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.headers['x-export-truncated']).toBe('false');
    expect(csv.text).toContain(`"'=SUM(A1)"`);
    expect(csv.text.trim().split('\r\n')).toHaveLength(4);

    await http()
      .get('/api/v2/audit-logs')
      .set(bearer(operator.token))
      .expect(403);
    const otherTrail = bodyOf<Page<AuditItem>>(
      await http()
        .get('/api/v2/audit-logs')
        .set(bearer(otherPlant.token))
        .expect(200),
    );
    expect(otherTrail.items).toHaveLength(1);
    await http()
      .get(`/api/v2/audit-logs/${list.items[0].id}`)
      .set(bearer(otherPlant.token))
      .expect(404);
  });

  it('counts audit entries per plant-local day, not per UTC day (DB-11)', async () => {
    const ds = harness.dataSource;
    await ds.query(`UPDATE tenants SET timezone = 'Asia/Tokyo' WHERE id = $1`, [
      world.plantA,
    ]);
    await ds.query(
      `UPDATE sites SET timezone = 'Asia/Tokyo' WHERE tenant_id = $1`,
      [world.plantA],
    );
    // 20:00 UTC on 1 Jan and 02:00 UTC on 2 Jan are both 2 Jan in Tokyo (UTC+9)
    for (const at of ['2026-01-01T20:00:00Z', '2026-01-02T02:00:00Z']) {
      await audit(world.plantA, manager.id, 'UPDATE', 'User', new Date(at), '');
    }
    const summary = bodyOf<{ byDay: Array<{ day: string; count: number }> }>(
      await http()
        .get(
          '/api/v2/audit-logs/summary?from=2026-01-01T00:00:00Z&to=2026-01-03T00:00:00Z',
        )
        .set(bearer(manager.token))
        .expect(200),
    );
    expect(summary.byDay).toEqual([{ day: '2026-01-02', count: 2 }]);
  });
});
