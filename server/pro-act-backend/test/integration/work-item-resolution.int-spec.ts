import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { NotificationResolutionModule } from '../../src/notifications/notification-resolution.module';
import { WorkItemResolutionConsumer } from '../../src/notifications/work-item-resolution.consumer';
import { WorkItemResolutionJob } from '../../src/notifications/work-item-resolution.job';
import { WorkItemResolver } from '../../src/notifications/work-item-resolver';
import { WorkReminderNotifier } from '../../src/notifications/work-reminder-notifier';
import { NotificationsV2Module } from '../../src/v2/notifications/notifications-v2.module';
import { IntegrationHarness } from './harness';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

const DUE = new Date('2026-10-09T14:00:00.000Z');
/** e3 (A2, 7 Oct 08:30–09:30) is uncoded; e4 (A2, from 7 Oct 12:00) is still running */
const FIRST_RUN = new Date('2026-10-07T14:30:00Z');

interface Row {
  user_id: string;
  kind: string;
  resolved_at: Date | null;
  resolution: string | null;
  read_at: Date | null;
  work_item_key: string | null;
}

interface View {
  id: string;
  kind: string;
  read: boolean;
  resolvedAt: string | null;
  resolution: string | null;
  workItemKey: string | null;
}

const listOf = (res: { body: unknown }): View[] =>
  (res.body as { items: View[] }).items;

/**
 * Shared work items (owner 18 Oct) on real Postgres: a reminder sent to several people is resolved for all
 * of them once anyone does the work — coded stops, an ended stop, a finished action, a rescheduled task, a
 * period stage passed — leaves the active list and unread count, stays readable as history, and comes back
 * when the work is owed again. Read / unread marks are per person.
 */
describe('shared work-item notifications', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let resolver: WorkItemResolver;
  const ids = {
    owner: randomUUID(),
    operator: randomUUID(),
    engineer: randomUUID(),
    manager: randomUUID(),
    rca: randomUUID(),
    action: randomUUID(),
    task: randomUUID(),
    period: randomUUID(),
  };
  const sql = <T = unknown>(query: string, params: unknown[] = []) =>
    harness.dataSource.query<T>(query, params);
  const rowsOf = (kind: string) =>
    sql<Row[]>(
      `SELECT user_id::text, kind, resolved_at, resolution, read_at, work_item_key
         FROM user_notifications WHERE tenant_id = $1 AND kind = $2 ORDER BY user_id`,
      [world.tenantA, kind],
    );
  const api = (userId: string) => {
    const token = signToken(app, {
      userId,
      tenantId: world.tenantA,
      role: 'Operator',
    });
    const server = request(app.getHttpServer());
    return {
      get: (path: string) => server.get(`/api/v2${path}`).set(bearer(token)),
      post: (path: string) =>
        server.post(`/api/v2${path}`).set(bearer(token)).send({}),
    };
  };

  const user = async (id: string, role: string, grant?: string) => {
    await sql(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id, is_active)
       VALUES ($1, 'Demo user', $2, 'x', $3, $4, true)`,
      [id, `${id}@test.local`, role, world.tenantA],
    );
    if (!grant) return;
    await sql(
      `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version)
       VALUES ($1, $2, 'tenant', $1, $3, 1)`,
      [world.tenantA, id, grant],
    );
  };

  const seed = async () => {
    const { tenantA, organizationId, events } = world;
    await user(ids.owner, 'viewer');
    await user(ids.operator, 'viewer', 'operator');
    await user(ids.engineer, 'viewer', 'production_engineer');
    await user(ids.manager, 'Manager');
    await sql(
      `INSERT INTO rcas (id, title, tenant_id, organization_id, team_lead_id) VALUES ($1, 'Trip', $2, $3, $4)`,
      [ids.rca, tenantA, organizationId, ids.manager],
    );
    await sql(
      `INSERT INTO rca_actions (id, tenant_id, row_version, rca_id, title, owner_id, due_date, status)
       VALUES ($1, $2, 1, $3, 'Replace bearing', $4, $5, 'open')`,
      [ids.action, tenantA, ids.rca, ids.owner, DUE],
    );
    await sql(
      `INSERT INTO tasks (id, title, assigned_to, assigned_by, priority, status, due_date, organization_id, tenant_id)
       VALUES ($1, 'Collect evidence', $2, $3, 'High', 'Open', $4, $5, $6)`,
      [ids.task, ids.owner, ids.manager, DUE, organizationId, tenantA],
    );
    await sql(
      `UPDATE production_events SET physical_type = 'advisory' WHERE tenant_id = $1`,
      [tenantA],
    );
    await sql(
      `UPDATE production_events SET physical_type = 'downtime', schedule_class = 'unplanned', coding_state = 'uncoded',
              physical_state = 'closed' WHERE id = $1`,
      [events.e3],
    );
    await sql(
      `UPDATE production_events SET physical_type = 'downtime', schedule_class = 'unplanned', physical_state = 'open',
              end_time = NULL WHERE id = $1`,
      [events.e4],
    );
  };

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, {
      modules: [NotificationsV2Module, NotificationResolutionModule],
    });
    resolver = app.get(WorkItemResolver);
    await seed();
    await app.get(WorkReminderNotifier).notify(world.tenantA, FIRST_RUN);
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  it('every copy of one work item carries the same key', async () => {
    const backlog = await rowsOf('uncoded_backlog');
    expect(backlog.map((r) => r.user_id).sort()).toEqual(
      [ids.operator, ids.engineer].sort(),
    );
    expect(new Set(backlog.map((r) => r.work_item_key))).toEqual(
      new Set([`uncoded:${world.unitA2}:2026-10-07`]),
    );
    expect(await resolver.resolve(world.tenantA)).toBe(0);
  });

  it('read and unread are per person; the unread count follows them', async () => {
    const operator = api(ids.operator);
    const before = (
      await operator.get('/notifications/unread-count').expect(200)
    ).body as { unread: number };
    const items = listOf(await operator.get('/notifications').expect(200));
    const backlog = items.find((n) => n.kind === 'uncoded_backlog');
    if (!backlog) throw new Error('backlog notification missing');
    await operator.post(`/notifications/${backlog.id}/read`).expect(200);
    const read = (await operator.get('/notifications/unread-count').expect(200))
      .body as { unread: number };
    expect(read.unread).toBe(before.unread - 1);
    const unread = (
      await operator.post(`/notifications/${backlog.id}/unread`).expect(200)
    ).body as View;
    expect(unread.read).toBe(false);
    await api(ids.engineer)
      .post(`/notifications/${backlog.id}/unread`)
      .expect(404);
  });

  it('coding the stop resolves the backlog for every recipient, via the domain message path', async () => {
    await sql(
      `UPDATE production_events SET coding_state = 'coded', reason_code_id = $2 WHERE id = $1`,
      [world.events.e3, world.reasonR1],
    );
    const consumer = app.get(WorkItemResolutionConsumer);
    expect(await consumer.resolveNow(world.tenantA)).toBe(2);
    const backlog = await rowsOf('uncoded_backlog');
    expect(
      backlog.every((r) => r.resolved_at && r.resolution === 'completed'),
    ).toBe(true);
    expect((await rowsOf('long_open_stop')).every((r) => !r.resolved_at)).toBe(
      true,
    );
    const hints = await sql<Array<{ n: number }>>(
      `SELECT count(*)::int AS n FROM outbox WHERE type = 'UserNotificationsResolved' AND tenant_id = $1`,
      [world.tenantA],
    );
    expect(hints[0].n).toBe(1);
  });

  it('a resolved notification leaves the active list and unread count and stays in history', async () => {
    const engineer = api(ids.engineer);
    const active = listOf(await engineer.get('/notifications').expect(200));
    expect(active.some((n) => n.kind === 'uncoded_backlog')).toBe(false);
    const history = listOf(
      await engineer.get('/notifications?state=resolved').expect(200),
    );
    expect(history).toEqual([
      expect.objectContaining({
        kind: 'uncoded_backlog',
        resolution: 'completed',
        workItemKey: `uncoded:${world.unitA2}:2026-10-07`,
      }),
    ]);
    const count = (
      await engineer.get('/notifications/unread-count').expect(200)
    ).body as { unread: number };
    expect(count.unread).toBe(1); // the long open stop only
  });

  it('an ended stop, a finished action and a rescheduled task resolve too', async () => {
    await sql(
      `UPDATE production_events SET end_time = '2026-10-07T15:00:00Z', physical_state = 'closed' WHERE id = $1`,
      [world.events.e4],
    );
    await sql(`UPDATE rca_actions SET status = 'done' WHERE id = $1`, [
      ids.action,
    ]);
    await sql(`UPDATE tasks SET due_date = $2 WHERE id = $1`, [
      ids.task,
      new Date(DUE.getTime() + 86_400_000),
    ]);
    expect(await app.get(WorkItemResolutionJob).sweep()).toBe(4);
    expect(
      (await rowsOf('long_open_stop')).every(
        (r) => r.resolution === 'completed',
      ),
    ).toBe(true);
    expect((await rowsOf('rca_action_due'))[0].resolution).toBe('completed');
    expect((await rowsOf('task_due'))[0].resolution).toBe('superseded');
  });

  it('a period reminder of a stage that passed resolves; the current stage stays open', async () => {
    const insert = (key: string) =>
      sql(
        `INSERT INTO user_notifications (tenant_id, row_version, user_id, kind, dedupe_key, entity_type, entity_id, detail, work_item_key)
         VALUES ($1, 1, $2, 'sla_reminder', $3, 'production_period', $4, '{}', $3)`,
        [world.tenantA, ids.engineer, key, ids.period],
      );
    await insert(`sla:${ids.period}:due:submit:none:0`);
    await insert(`sla:${ids.period}:due:approve:${randomUUID()}:0`);
    expect(await resolver.resolve(world.tenantA)).toBe(1);
    const open = await sql<Array<{ dedupe_key: string }>>(
      `SELECT dedupe_key FROM user_notifications WHERE kind = 'sla_reminder' AND resolved_at IS NULL`,
    );
    expect(open.map((r) => r.dedupe_key)).toEqual([
      `sla:${ids.period}:due:submit:none:0`,
    ]);
  });

  it('work owed again re-opens the notification as new and unread', async () => {
    await sql(
      `UPDATE production_events SET coding_state = 'uncoded', reason_code_id = NULL WHERE id = $1`,
      [world.events.e3],
    );
    const reopened = await app
      .get(WorkReminderNotifier)
      .notify(world.tenantA, FIRST_RUN);
    expect(reopened).toBe(2);
    const backlog = await rowsOf('uncoded_backlog');
    expect(backlog.every((r) => !r.resolved_at && !r.read_at)).toBe(true);
  });

  it('an item still owed shows the current count, not the count at alert time (O2)', async () => {
    // alerted for both closed stops of 7 Oct (e3 1 h, e4 3 h); then e4 is coded and only e3 is owed
    await sql(
      `UPDATE user_notifications SET detail = detail || '{"stops": 2, "uncodedSeconds": 14400,
              "message": "2 uncoded stop(s) waiting for a reason"}'::jsonb
        WHERE tenant_id = $1 AND kind = 'uncoded_backlog'`,
      [world.tenantA],
    );
    await sql(
      `UPDATE production_events SET coding_state = 'coded', reason_code_id = $2 WHERE id = $1`,
      [world.events.e4, world.reasonR1],
    );
    await sql(
      `UPDATE user_notifications SET read_at = now() WHERE tenant_id = $1 AND kind = 'uncoded_backlog' AND user_id = $2`,
      [world.tenantA, ids.operator],
    );
    const before = await sql<Array<{ created_at: Date }>>(
      `SELECT created_at FROM user_notifications WHERE tenant_id = $1 AND kind = 'uncoded_backlog' ORDER BY user_id`,
      [world.tenantA],
    );
    expect(await resolver.resolve(world.tenantA)).toBe(0);
    const rows = await sql<
      Array<{
        user_id: string;
        stops: number;
        seconds: number;
        message: string;
        read: boolean;
        resolved: boolean;
        created_at: Date;
      }>
    >(
      `SELECT user_id::text, (detail->>'stops')::int AS stops, (detail->>'uncodedSeconds')::int AS seconds,
              detail->>'message' AS message, read_at IS NOT NULL AS read, resolved_at IS NOT NULL AS resolved, created_at
         FROM user_notifications WHERE tenant_id = $1 AND kind = 'uncoded_backlog' ORDER BY user_id`,
      [world.tenantA],
    );
    expect(
      rows.map((r) => [r.stops, r.seconds, r.message, r.resolved]),
    ).toEqual(
      rows.map(() => [
        1,
        3600,
        '1 uncoded stop(s) waiting for a reason',
        false,
      ]),
    );
    expect(rows.find((r) => r.user_id === ids.operator)?.read).toBe(true);
    expect(rows.map((r) => r.created_at.getTime())).toEqual(
      before.map((r) => r.created_at.getTime()),
    );
    const view = listOf(
      await api(ids.engineer).get('/notifications').expect(200),
    );
    expect(view.filter((n) => n.kind === 'uncoded_backlog')).toHaveLength(1);
    expect(await resolver.resolve(world.tenantA)).toBe(0);
  });
});
