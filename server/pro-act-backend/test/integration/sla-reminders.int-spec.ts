import { randomUUID } from 'crypto';
import { SlaEscalationNotifier } from '../../src/notifications/sla-escalation-notifier';
import { ReconciliationWorld } from './support/reconciliation-world';

const HOUR_MS = 3_600_000;

/**
 * SME R3 due reminders on real Postgres (policy defaults: submit 12 h, approve 24 h after the production day
 * ends): the preparer is reminded when submission falls due, the checkers when approval falls due — never
 * the preparer — once per period, stage and submission cycle; a rejection's new due time reminds again.
 */
describe('SLA due reminders (SME R3)', () => {
  const env = new ReconciliationWorld();
  let notifier: SlaEscalationNotifier;
  let dayEnd = 0;
  const ids = {
    accountant: randomUUID(),
    manager: randomUUID(),
    engineer: randomUUID(),
    preparer: randomUUID(),
  };

  const user = async (id: string, role: string, scope: 'tenant' | 'unit') => {
    await env.rows(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id) VALUES ($1, $2, $3, 'x', 'Operator', $4)`,
      [id, `Demo ${role}`, `${id}@test.local`, env.world.tenantA],
    );
    await env.rows(
      `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version)
       VALUES ($1, $2, $3, $4, $5, 1)`,
      [
        env.world.tenantA,
        id,
        scope,
        scope === 'tenant' ? env.world.tenantA : env.world.unitA1,
        role,
      ],
    );
  };
  const revisionOf = async (periodId: string): Promise<string> =>
    (
      await env.rows<{ id: string }>(
        `SELECT id FROM accounting_revisions WHERE period_id = $1 ORDER BY revision DESC LIMIT 1`,
        [periodId],
      )
    )[0].id;
  const reminders = (periodId: string) =>
    env.rows<{ user_id: string; dedupe_key: string; stage: string }>(
      `SELECT user_id, dedupe_key, detail->>'stage' AS stage FROM user_notifications
        WHERE kind = 'sla_reminder' AND entity_id = $1 ORDER BY dedupe_key, user_id`,
      [periodId],
    );
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
    await user(ids.accountant, 'production_accountant', 'tenant');
    await user(ids.manager, 'manager_approver', 'unit');
    await user(ids.engineer, 'production_engineer', 'tenant');
    await user(ids.preparer, 'production_engineer', 'unit');
    // A1 was submitted by the preparer (in review); B1 and C1 are drafts nobody has worked on
    const revision = await revisionOf(env.periodA1);
    await env.rows(
      `INSERT INTO approval_actions (tenant_id, row_version, revision_id, period_id, action, from_lifecycle, to_lifecycle, actor_id)
       VALUES ($1, 1, $2, $3, 'submit', 'draft', 'in_review', $4)`,
      [env.world.tenantA, revision, env.periodA1, ids.preparer],
    );
    await env.rows(
      `UPDATE accounting_revisions SET lifecycle = 'in_review', submitted_by = $2, submitted_at = now() WHERE id = $1`,
      [revision, ids.preparer],
    );
  });
  afterAll(() => env.stop());

  it('nothing before the submit due time (12 h after the production day ended)', async () => {
    await notifyAt(11);
    expect(await reminders(env.periodB1)).toEqual([]);
  });

  it('submit due: a draft nobody worked on reminds production accounting of the unit, once', async () => {
    await notifyAt(13);
    const b1 = await reminders(env.periodB1);
    expect(b1.map((r) => [r.user_id, r.stage])).toEqual([
      [ids.accountant, 'submit'],
    ]);
    expect(b1[0].dedupe_key).toMatch(/^sla:.*:due:submit:.*:0$/);
    await notifyAt(13);
    await notifyAt(20);
    expect(await reminders(env.periodB1)).toHaveLength(1);
    // the submitted period is not due for approval before 24 h
    expect(await reminders(env.periodA1)).toEqual([]);
  });

  it('approve due: the checkers (revision approvers of the unit) are reminded, never the preparer', async () => {
    await notifyAt(25);
    const a1 = await reminders(env.periodA1);
    expect(a1.map((r) => r.user_id).sort()).toEqual(
      [ids.accountant, ids.manager].sort(),
    );
    expect(a1.every((r) => r.stage === 'approve')).toBe(true);
    expect(a1.some((r) => r.user_id === ids.preparer)).toBe(false);
    expect(a1.some((r) => r.user_id === ids.engineer)).toBe(false);
  });

  it('a rejection sets a new due time (12 h after it) and reminds again in the new cycle', async () => {
    const revision = await revisionOf(env.periodC1);
    await env.rows(
      `INSERT INTO approval_actions (tenant_id, row_version, revision_id, period_id, action, from_lifecycle, to_lifecycle, created_at)
       VALUES ($1, 1, $2, $3, 'reject', 'in_review', 'draft', $4)`,
      [
        env.world.tenantA,
        revision,
        env.periodC1,
        new Date(dayEnd + 20 * HOUR_MS),
      ],
    );
    await notifyAt(31);
    expect(
      (await reminders(env.periodC1)).filter((r) =>
        r.dedupe_key.endsWith(':1'),
      ),
    ).toEqual([]);
    await notifyAt(33);
    const second = (await reminders(env.periodC1)).filter((r) =>
      r.dedupe_key.endsWith(':1'),
    );
    expect(second.map((r) => r.user_id)).toEqual([ids.accountant]);
  });
});
