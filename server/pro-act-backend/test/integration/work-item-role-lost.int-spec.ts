import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NotificationResolutionModule } from '../../src/notifications/notification-resolution.module';
import { WorkItemResolver } from '../../src/notifications/work-item-resolver';
import { WorkReminderNotifier } from '../../src/notifications/work-reminder-notifier';
import { NotificationsV2Module } from '../../src/v2/notifications/notifications-v2.module';
import { IntegrationHarness } from './harness';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { createIntegrationApp } from './support/test-app';

/** e3 (A2, 7 Oct 08:30–09:30) is uncoded; e4 (A2, from 7 Oct 12:00) is still running */
const FIRST_RUN = new Date('2026-10-07T14:30:00Z');
const LATER = new Date('2026-10-07T15:30:00Z');

interface Row {
  user_id: string;
  resolved_at: Date | null;
  resolution: string | null;
}

/**
 * QA re-test decision 2026-10-19 ("Stale work reminders"): when a recipient loses the role that made them a
 * recipient, their open copy of the role's reminder resolves (`superseded`), the other holders' copies stay
 * open, and the reminder comes back if the role does.
 */
describe('work reminders of a recipient who lost the role', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let resolver: WorkItemResolver;
  const ids = {
    operator: randomUUID(),
    engineer: randomUUID(),
    manager: randomUUID(),
  };
  const sql = <T = unknown>(query: string, params: unknown[] = []) =>
    harness.dataSource.query<T>(query, params);
  const rowsOf = (kind: string) =>
    sql<Row[]>(
      `SELECT user_id::text, resolved_at, resolution FROM user_notifications
        WHERE tenant_id = $1 AND kind = $2 ORDER BY user_id`,
      [world.tenantA, kind],
    );
  const rowOf = async (kind: string, userId: string) =>
    (await rowsOf(kind)).find((row) => row.user_id === userId);

  const user = async (id: string, role: string, grant?: string) => {
    await sql(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id, is_active)
       VALUES ($1, 'Demo user', $2, 'x', $3, $4, true)`,
      [id, `${id}@test.local`, role, world.tenantA],
    );
    if (grant) await grantRole(id, grant);
  };
  const grantRole = (id: string, role: string) =>
    sql(
      `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version)
       VALUES ($1, $2, 'tenant', $1, $3, 1)`,
      [world.tenantA, id, role],
    );

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, {
      modules: [NotificationsV2Module, NotificationResolutionModule],
    });
    resolver = app.get(WorkItemResolver);
    await user(ids.operator, 'viewer', 'operator');
    await user(ids.engineer, 'viewer', 'production_engineer');
    await user(ids.manager, 'Manager');
    await sql(
      `UPDATE production_events SET physical_type = 'advisory' WHERE tenant_id = $1`,
      [world.tenantA],
    );
    await sql(
      `UPDATE production_events SET physical_type = 'downtime', schedule_class = 'unplanned', coding_state = 'uncoded',
              physical_state = 'closed' WHERE id = $1`,
      [world.events.e3],
    );
    await sql(
      `UPDATE production_events SET physical_type = 'downtime', schedule_class = 'unplanned', physical_state = 'open',
              end_time = NULL WHERE id = $1`,
      [world.events.e4],
    );
    await app.get(WorkReminderNotifier).notify(world.tenantA, FIRST_RUN);
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  it('nothing resolves while every recipient still holds the role', async () => {
    expect(
      (await rowsOf('uncoded_backlog')).map((r) => r.user_id).sort(),
    ).toEqual([ids.operator, ids.engineer].sort());
    expect(await rowOf('long_open_stop', ids.manager)).toBeDefined();
    expect(await resolver.resolve(world.tenantA, LATER)).toBe(0);
  });

  it('a revoked grant resolves only that recipient’s copy, as superseded', async () => {
    await sql(`DELETE FROM user_scopes WHERE user_id = $1`, [ids.operator]);
    expect(await resolver.resolve(world.tenantA, LATER)).toBe(1);
    expect(await rowOf('uncoded_backlog', ids.operator)).toMatchObject({
      resolution: 'superseded',
    });
    expect(
      (await rowOf('uncoded_backlog', ids.engineer))?.resolved_at,
    ).toBeNull();
  });

  it('an own grant of another role ends the legacy fallback, and its reminders', async () => {
    await grantRole(ids.manager, 'quality_approver');
    expect(await resolver.resolve(world.tenantA, LATER)).toBe(1);
    expect(await rowOf('long_open_stop', ids.manager)).toMatchObject({
      resolution: 'superseded',
    });
    expect(
      (await rowOf('long_open_stop', ids.engineer))?.resolved_at,
    ).toBeNull();
  });

  it('a deactivated recipient no longer holds the role', async () => {
    await sql(`UPDATE users SET is_active = false WHERE id = $1`, [
      ids.engineer,
    ]);
    expect(await resolver.resolve(world.tenantA, LATER)).toBe(2);
    expect(await rowOf('uncoded_backlog', ids.engineer)).toMatchObject({
      resolution: 'superseded',
    });
    await sql(`UPDATE users SET is_active = true WHERE id = $1`, [
      ids.engineer,
    ]);
  });

  it('the reminder comes back when the role does', async () => {
    await grantRole(ids.operator, 'operator');
    await app.get(WorkReminderNotifier).notify(world.tenantA, LATER);
    expect(
      (await rowOf('uncoded_backlog', ids.operator))?.resolved_at,
    ).toBeNull();
    expect(await resolver.resolve(world.tenantA, LATER)).toBe(0);
  });
});
