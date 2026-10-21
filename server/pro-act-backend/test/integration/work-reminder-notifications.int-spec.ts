import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { WorkReminderJob } from '../../src/notifications/work-reminder.job';
import { WorkReminderNotifier } from '../../src/notifications/work-reminder-notifier';
import { NotificationsV2Module } from '../../src/v2/notifications/notifications-v2.module';
import { IntegrationHarness } from './harness';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
/** due date of the action and the task; the open stop e4 started 7 Oct 12:00, the uncoded stop e3 ended 09:30 */
const DUE = new Date('2026-10-09T14:00:00.000Z');
const at = (iso: string) => new Date(iso);

interface NotificationBody {
  kind: string;
  entityType: string;
  entityId: string;
  detail: { message: string; rcaId?: string; level: number };
}

/**
 * Item 6 work and downtime reminders on real Postgres: due / overdue RCA actions and tasks (owner, then
 * the case team lead / assigner after 7 days), uncoded stop backlog (operators and production engineers of
 * the unit) and long open stops (production engineering and plant management of the unit) — once per
 * record and level whatever how often it runs; inactive users, other units, other plants and owners who are
 * not members of the plant get nothing.
 */
describe('work and downtime reminders (item 6)', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let notifier: WorkReminderNotifier;
  const ids = {
    owner: randomUUID(),
    lead: randomUUID(),
    assigner: randomUUID(),
    outsiderOwner: randomUUID(),
    operatorA2: randomUUID(),
    operatorA1: randomUUID(),
    engineerPlant: randomUUID(),
    inactiveEngineer: randomUUID(),
    engineerB: randomUUID(),
    legacyManager: randomUUID(),
    rca: randomUUID(),
    action: randomUUID(),
    outsiderAction: randomUUID(),
    task: randomUUID(),
  };

  const sql = <T = unknown>(query: string, params: unknown[] = []) =>
    harness.dataSource.query<T>(query, params);
  const user = async (
    id: string,
    input: { role: string; tenantId: string; active?: boolean },
    grant?: { role: string; kind: string; scopeId: string; tenantId: string },
  ) => {
    await sql(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id, is_active)
       VALUES ($1, 'Demo user', $2, 'x', $3, $4, $5)`,
      [
        id,
        `${id}@test.local`,
        input.role,
        input.tenantId,
        input.active ?? true,
      ],
    );
    if (!grant) return;
    await sql(
      `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version)
       VALUES ($1, $2, $3, $4, $5, 1)`,
      [grant.tenantId, id, grant.kind, grant.scopeId, grant.role],
    );
  };
  const count = async (userId: string, kind: string): Promise<number> => {
    const rows = await sql<Array<{ n: number }>>(
      `SELECT count(*)::int AS n FROM user_notifications WHERE user_id = $1 AND kind = $2`,
      [userId, kind],
    );
    return rows[0].n;
  };
  const totalOf = async (userId: string): Promise<number> => {
    const rows = await sql<Array<{ n: number }>>(
      `SELECT count(*)::int AS n FROM user_notifications WHERE user_id = $1`,
      [userId],
    );
    return rows[0].n;
  };
  const notifyAt = (asOf: Date) => notifier.notify(world.tenantA, asOf);

  const seedPeople = async () => {
    const { tenantA, tenantB, unitA1, unitA2 } = world;
    const plant = (role: string) => ({
      role,
      kind: 'tenant',
      scopeId: tenantA,
      tenantId: tenantA,
    });
    const unit = (role: string, scopeId: string) => ({
      role,
      kind: 'unit',
      scopeId,
      tenantId: tenantA,
    });
    await user(ids.owner, { role: 'viewer', tenantId: tenantA });
    await user(ids.lead, { role: 'viewer', tenantId: tenantA });
    await user(ids.assigner, { role: 'viewer', tenantId: tenantA });
    await user(ids.outsiderOwner, { role: 'viewer', tenantId: tenantB });
    await user(
      ids.operatorA2,
      { role: 'viewer', tenantId: tenantA },
      unit('operator', unitA2),
    );
    await user(
      ids.operatorA1,
      { role: 'viewer', tenantId: tenantA },
      unit('operator', unitA1),
    );
    await user(
      ids.engineerPlant,
      { role: 'viewer', tenantId: tenantA },
      plant('production_engineer'),
    );
    await user(
      ids.inactiveEngineer,
      { role: 'viewer', tenantId: tenantA, active: false },
      plant('production_engineer'),
    );
    await user(
      ids.engineerB,
      { role: 'viewer', tenantId: tenantB },
      {
        role: 'production_engineer',
        kind: 'tenant',
        scopeId: tenantB,
        tenantId: tenantB,
      },
    );
    await user(ids.legacyManager, { role: 'Manager', tenantId: tenantA });
  };

  const seedWork = async () => {
    const { tenantA, organizationId } = world;
    await sql(
      `INSERT INTO rcas (id, title, tenant_id, organization_id, team_lead_id) VALUES ($1, 'Extruder trip', $2, $3, $4)`,
      [ids.rca, tenantA, organizationId, ids.lead],
    );
    await sql(
      `INSERT INTO rca_actions (id, tenant_id, row_version, rca_id, title, owner_id, due_date, status)
       VALUES ($1, $3, 1, $4, 'Replace bearing', $5, $7, 'open'),
              ($2, $3, 1, $4, 'Update procedure', $6, $7, 'in_progress')`,
      [
        ids.action,
        ids.outsiderAction,
        tenantA,
        ids.rca,
        ids.owner,
        ids.outsiderOwner,
        // an action's due_date is the START of its due plant day and the day is due in full (21 Oct 2026):
        // the action whose day ends at DUE is stored a day earlier, so it falls due with the task
        new Date(DUE.getTime() - DAY_MS),
      ],
    );
    await sql(
      `INSERT INTO tasks (id, title, assigned_to, assigned_by, priority, status, due_date, organization_id, tenant_id)
       VALUES ($1, 'Collect evidence', $2, $3, 'High', 'Open', $4, $5, $6)`,
      [ids.task, ids.owner, ids.assigner, DUE, organizationId, tenantA],
    );
  };

  /** e3 (A2, 08:30–09:30) is a closed uncoded unplanned stop, e4 (A2, from 12:00) an open one; others are advisories. */
  const seedStops = async () => {
    const { tenantA, events } = world;
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
      modules: [NotificationsV2Module],
    });
    notifier = app.get(WorkReminderNotifier);
    await seedPeople();
    await seedWork();
    await seedStops();
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  it('nothing before the lead time, the 2 h run time or 4 h after an uncoded stop ended', async () => {
    expect(await notifyAt(at('2026-10-07T13:00:00Z'))).toBe(0);
  });

  it('due soon, long open stop and uncoded backlog reach their people once; reruns add nothing', async () => {
    const created = await notifyAt(at('2026-10-07T14:30:00Z'));
    expect(created).toBe(6);
    expect(await count(ids.owner, 'rca_action_due')).toBe(1);
    expect(await count(ids.owner, 'task_due')).toBe(1);
    expect(await count(ids.engineerPlant, 'long_open_stop')).toBe(1);
    expect(await count(ids.legacyManager, 'long_open_stop')).toBe(1);
    expect(await count(ids.operatorA2, 'uncoded_backlog')).toBe(1);
    expect(await count(ids.engineerPlant, 'uncoded_backlog')).toBe(1);
    for (const nobody of [
      ids.outsiderOwner,
      ids.operatorA1,
      ids.inactiveEngineer,
      ids.engineerB,
      ids.lead,
      ids.assigner,
    ]) {
      expect(await totalOf(nobody)).toBe(0);
    }
    expect(await notifyAt(at('2026-10-07T14:30:00Z'))).toBe(0);
    expect(await notifyAt(at('2026-10-07T15:00:00Z'))).toBe(0);
    const hints = await sql<Array<{ n: number }>>(
      `SELECT count(*)::int AS n FROM outbox WHERE type = 'UserNotificationsCreated' AND tenant_id = $1`,
      [world.tenantA],
    );
    expect(hints[0].n).toBe(1);
  });

  it('8 h: the long open stop is told again at level 2, once', async () => {
    expect(await notifyAt(at('2026-10-07T20:30:00Z'))).toBe(2);
    expect(await count(ids.engineerPlant, 'long_open_stop')).toBe(2);
    expect(await notifyAt(at('2026-10-07T21:00:00Z'))).toBe(0);
  });

  it('overdue: the owner, and after 7 days the case team lead and the task assigner, once each', async () => {
    await notifyAt(new Date(DUE.getTime() + HOUR_MS));
    expect(await count(ids.owner, 'rca_action_overdue')).toBe(1);
    expect(await count(ids.owner, 'task_overdue')).toBe(1);
    expect(await totalOf(ids.lead)).toBe(0);
    await notifyAt(new Date(DUE.getTime() + 7 * DAY_MS));
    await notifyAt(new Date(DUE.getTime() + 8 * DAY_MS));
    // one per action of the case: the lead also hears of the action whose owner is not a plant member
    expect(await count(ids.lead, 'rca_action_overdue')).toBe(2);
    expect(await count(ids.assigner, 'task_overdue')).toBe(1);
    expect(await count(ids.owner, 'rca_action_overdue')).toBe(1);
    expect(await totalOf(ids.outsiderOwner)).toBe(0);
  });

  it('the read API names the record and a message for the bell link', async () => {
    const token = signToken(app, {
      userId: ids.owner,
      tenantId: world.tenantA,
      role: 'Operator',
    });
    const res = await request(app.getHttpServer())
      .get('/api/v2/notifications')
      .set(bearer(token))
      .expect(200);
    const { items } = res.body as { items: NotificationBody[] };
    const due = items.find((n) => n.kind === 'rca_action_due');
    expect(due).toMatchObject({
      entityType: 'rca_action',
      entityId: ids.action,
      detail: {
        rcaId: ids.rca,
        message: 'Corrective action due soon',
        level: 0,
      },
    });
    expect(items.find((n) => n.kind === 'task_due')).toMatchObject({
      entityType: 'task',
      entityId: ids.task,
    });
  });

  it('the job sweeps every active plant and is idempotent', async () => {
    const job = app.get(WorkReminderJob);
    expect(await job.sweep(new Date(DUE.getTime() + 8 * DAY_MS))).toBe(0);
  });
});
