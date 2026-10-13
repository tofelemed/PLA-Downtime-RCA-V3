import { A, HOUR } from './support/actuals-world';
import { AccountingWorld, plus } from './support/accounting-world';

/**
 * LA-03 on real Postgres: approving a superseding sustained rate (ProfileBaselineChanged) and
 * re-publishing the calendar with regenerated past dates queue recomputes of the periods they cover,
 * through the outbox and the inbox, and the next run prices the stop at the new rate.
 */
describe('baseline and calendar changes recalculate periods (LA-03)', () => {
  const env = new AccountingWorld();
  let periodA1 = '';

  beforeAll(async () => {
    await env.start();
    await env.approvedPlan(env.world.unitA1);
    await env.materialize([env.world.unitA1]);
    periodA1 = await env.periodId(env.world.unitA1, A);
    await env.outputEvent(env.world.unitA1, A, plus(A, 8 * HOUR), '300');
    await env.lossEvent(env.world.unitA1, plus(A, HOUR), 1);
    await env.settle();
  });
  afterAll(() => env.stop());

  const triggers = () =>
    env.rows<{ trigger: string }>(
      `SELECT DISTINCT "request"->>'trigger' AS "trigger" FROM "actuals_jobs" WHERE "period_id" = $1`,
      [periodA1],
    );

  it('a superseding sustained rate recalculates the period at the new rate', async () => {
    const before = await env.accounting(periodA1);
    expect(env.totals(before, 'capacity').availability).toBe('100');
    const profileId = env.profiles.get(
      `${env.world.unitA1}:${env.products.p1}`,
    )!;
    const created = await env
      .post(`profiles/${profileId}/rates`, {
        rateKind: 'sustained',
        rate: '120',
        timebase: 'h',
        effectiveFrom: '2026-06-01T00:00:00Z',
      })
      .expect(201);
    await env
      .post(
        `rates/${(created.body as { id: string }).id}/approve`,
        { supersede: true },
        env.approver,
      )
      .expect(200);
    await env.settle();
    expect((await triggers()).map((t) => t.trigger)).toContain(
      'profile_baseline_changed',
    );
    const after = await env.accounting(periodA1);
    expect(after.data.run!.id).not.toBe(before.data.run!.id);
    expect(env.totals(after, 'capacity')).toMatchObject({
      capacity: '960',
      availability: '120',
    });
  });

  it('a calendar republish that regenerates past dates queues a recompute of the site’s units', async () => {
    const [version] = await env.rows<{ id: string }>(
      `SELECT "id" FROM "calendar_versions" WHERE "tenant_id" = $1 AND "unit_id" IS NULL AND "state" = 'published'`,
      [env.world.tenantA],
    );
    const [{ today }] = await env.rows<{ today: string }>(
      `SELECT to_char((now() AT TIME ZONE 'Asia/Tehran')::date - 2, 'YYYY-MM-DD') AS "today"`,
    );
    await env
      .post(`calendar-versions/${version.id}/publish`, {
        reason: 'LA-03 regenerate',
        regenerateFrom: today,
      })
      .expect(200);
    await env.relay();
    expect((await triggers()).map((t) => t.trigger)).toContain(
      'calendar_republished',
    );
  });
});
