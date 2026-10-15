import { randomUUID } from 'crypto';
import { SlaEscalationJob } from '../../src/notifications/sla-escalation.job';
import { SlaEscalationNotifier } from '../../src/notifications/sla-escalation-notifier';
import { ApiError } from './support/plan-world';
import { ReconciliationWorld } from './support/reconciliation-world';
import { signToken } from './support/test-app';

const HOUR_MS = 3_600_000;

interface NotificationBody {
  id: string;
  kind: string;
  entityId: string;
  read: boolean;
  detail: { reason: string; level: number; role: string; periodId: string };
}

/**
 * SLA escalation notifications (SME R3 / R6, EXPERT_REVIEW Area 3) on real Postgres: the producer the worker
 * job runs tells the holders of the escalation role in the plant — production accounting at 48 h, plant
 * management at 72 h (policy defaults) — once per period and level whatever how often it runs; holders of a
 * grant on another unit, other roles and other plants get nothing; each user reads and marks only their own.
 */
describe('SLA escalation notifications (SME R3 / R6)', () => {
  const env = new ReconciliationWorld();
  let notifier: SlaEscalationNotifier;
  let dayEnd = 0;
  const ids = {
    accountantPlant: randomUUID(),
    accountantUnit: randomUUID(),
    accountantOtherUnit: randomUUID(),
    engineer: randomUUID(),
    legacyManager: randomUUID(),
  };

  const user = async (
    id: string,
    legacyRole: string,
    grant: { role: string; kind: string; scopeId: string } | null,
  ) => {
    await env.rows(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id) VALUES ($1, $2, $3, 'x', $4, $5)`,
      [
        id,
        `Demo ${legacyRole}`,
        `${id}@test.local`,
        legacyRole,
        env.world.tenantA,
      ],
    );
    if (!grant) return;
    await env.rows(
      `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version)
       VALUES ($1, $2, $3, $4, $5, 1)`,
      [env.world.tenantA, id, grant.kind, grant.scopeId, grant.role],
    );
  };
  const tokenOf = (id: string) =>
    signToken(env.app, {
      userId: id,
      tenantId: env.world.tenantA,
      role: 'Operator',
    });
  const countFor = async (userId: string): Promise<number> => {
    const rows = await env.rows<{ n: number }>(
      `SELECT count(*)::int AS n FROM user_notifications WHERE user_id = $1 AND kind = 'sla_escalation'`,
      [userId],
    );
    return rows[0].n;
  };
  const notifyAt = (hours: number) =>
    notifier.notify(env.world.tenantA, new Date(dayEnd + hours * HOUR_MS));

  beforeAll(async () => {
    await env.start();
    notifier = env.app.get(SlaEscalationNotifier);
    const [row] = await env.rows<{ day_end: Date }>(
      `SELECT max(q.utc_end) AS day_end FROM production_periods q
         JOIN production_periods p ON p.unit_id = q.unit_id AND p.local_date = q.local_date
        WHERE p.id = $1`,
      [env.periodA1],
    );
    dayEnd = new Date(row.day_end).getTime();
    const unit = (role: string, scopeId: string) => ({
      role,
      kind: 'unit',
      scopeId,
    });
    await user(ids.accountantPlant, 'Operator', {
      role: 'production_accountant',
      kind: 'tenant',
      scopeId: env.world.tenantA,
    });
    await user(
      ids.accountantUnit,
      'Operator',
      unit('production_accountant', env.world.unitA1),
    );
    await user(
      ids.accountantOtherUnit,
      'Operator',
      unit('production_accountant', env.world.unitA2),
    );
    await user(ids.engineer, 'Operator', {
      role: 'production_engineer',
      kind: 'tenant',
      scopeId: env.world.tenantA,
    });
    await user(ids.legacyManager, 'Manager', null);
  });
  afterAll(() => env.stop());

  // due reminders (12 h / 24 h) are created too; `sla-reminders.int-spec` covers them
  const hintCount = async () =>
    (
      await env.rows<{ n: number }>(
        `SELECT count(*)::int AS n FROM outbox WHERE type = 'UserNotificationsCreated' AND tenant_id = $1`,
        [env.world.tenantA],
      )
    )[0].n;

  it('no escalation before 48 h after the production day ended', async () => {
    await notifyAt(47);
    expect(await countFor(ids.accountantPlant)).toBe(0);
  });

  it('48 h: production accounting of the plant and of the unit, one per period; idempotent on reruns', async () => {
    const created = await notifyAt(49);
    expect(created).toBeGreaterThanOrEqual(6);
    const hintsAfterFirst = await hintCount();
    expect(await countFor(ids.accountantPlant)).toBe(3);
    expect(await countFor(ids.accountantUnit)).toBe(3);
    expect(await countFor(ids.accountantOtherUnit)).toBe(0);
    expect(await countFor(ids.engineer)).toBe(0);
    expect(await countFor(ids.legacyManager)).toBe(0);
    expect(await notifyAt(49)).toBe(0);
    expect(await notifyAt(60)).toBe(0);
    expect(await countFor(ids.accountantPlant)).toBe(3);
    expect(await hintCount()).toBe(hintsAfterFirst);
  });

  it('72 h: plant management (legacy Manager of the home plant) once per period; production accounting gets nothing new', async () => {
    await notifyAt(73);
    expect(await countFor(ids.legacyManager)).toBe(3);
    expect(await countFor(ids.accountantPlant)).toBe(3);
    await notifyAt(80);
    expect(await countFor(ids.legacyManager)).toBe(3);
    const levels = await env.rows<{ level: string }>(
      `SELECT detail->>'level' AS level FROM user_notifications WHERE user_id = $1`,
      [ids.legacyManager],
    );
    expect(levels.map((l) => l.level)).toEqual(['2', '2', '2']);
  });

  it('a user lists, counts and marks only their own notifications', async () => {
    const token = tokenOf(ids.accountantUnit);
    await env.rows(
      `DELETE FROM user_notifications WHERE kind = 'sla_reminder' AND tenant_id = $1`,
      [env.world.tenantA],
    );
    const list = (await env.get('notifications', token).expect(200)).body as {
      items: NotificationBody[];
    };
    expect(list.items).toHaveLength(3);
    expect(list.items[0]).toMatchObject({
      kind: 'sla_escalation',
      read: false,
      detail: { reason: 'age', level: 1, role: 'production_accountant' },
    });
    const count = async (t: string) =>
      (
        (await env.get('notifications/unread-count', t).expect(200)).body as {
          unread: number;
        }
      ).unread;
    expect(await count(token)).toBe(3);
    const read = (
      await env
        .post(`notifications/${list.items[0].id}/read`, {}, token)
        .expect(200)
    ).body as NotificationBody;
    expect(read.read).toBe(true);
    expect(await count(token)).toBe(2);
    const unread = (
      await env.get('notifications?unread=true', token).expect(200)
    ).body as { items: NotificationBody[] };
    expect(unread.items).toHaveLength(2);
    const other = tokenOf(ids.accountantPlant);
    const foreign = await env
      .post(`notifications/${list.items[1].id}/read`, {}, other)
      .expect(404);
    expect((foreign.body as ApiError).code).toBeDefined();
    const all = (
      await env.post('notifications/read-all', {}, token).expect(200)
    ).body as { updated: number };
    expect(all.updated).toBe(2);
    expect(await count(token)).toBe(0);
    expect(await count(other)).toBe(3);
  });

  it('the 3rd rejection of a revision tells production accounting once; the worker job sweep adds nothing twice', async () => {
    // the period's current revision (created by the world's recalculation), rejected three times
    const [current] = await env.rows<{ id: string }>(
      `SELECT id FROM accounting_revisions WHERE period_id = $1 ORDER BY revision DESC LIMIT 1`,
      [env.periodB1],
    );
    const revisionId = current.id;
    for (let i = 0; i < 3; i += 1) {
      await env.rows(
        `INSERT INTO approval_actions (tenant_id, row_version, revision_id, period_id, action, from_lifecycle, to_lifecycle, created_at)
         VALUES ($1, 1, $2, $3, 'reject', 'in_review', 'draft', $4)`,
        [
          env.world.tenantA,
          revisionId,
          env.periodB1,
          new Date(dayEnd + HOUR_MS),
        ],
      );
    }
    await notifyAt(81);
    const rejection = await env.rows<{ user_id: string }>(
      `SELECT user_id FROM user_notifications WHERE dedupe_key = $1 ORDER BY user_id`,
      [`sla:${env.periodB1}:rejection:${revisionId}`],
    );
    expect(rejection.map((r) => r.user_id)).toEqual(
      [ids.accountantPlant, ids.accountantUnit].sort(),
    );
    const job = env.app.get(SlaEscalationJob);
    await job.sweep(new Date(dayEnd + 82 * HOUR_MS));
    await job.sweep(new Date(dayEnd + 82 * HOUR_MS));
    expect(await countFor(ids.accountantPlant)).toBe(4);
    expect(await countFor(ids.legacyManager)).toBe(3);
  });
});
