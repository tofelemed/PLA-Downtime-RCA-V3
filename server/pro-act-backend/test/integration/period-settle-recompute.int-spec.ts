import { PeriodSweepJob } from '../../src/periods/period-sweep.job';
import { A, B, HOUR } from './support/actuals-world';
import { AccountingWorld, plus } from './support/accounting-world';

/**
 * DT-08: a period calculated while one of its stops was still open measured that stop only up to the
 * run instant. Once the period has ended and settled, the sweep queues one recompute so the stop is
 * measured to the period end; a period whose run measured no open event is not queued again.
 */
describe('settled periods with a stop measured open are recomputed (DT-08)', () => {
  const env = new AccountingWorld();
  let periodA1 = '';
  let periodA2 = '';

  beforeAll(async () => {
    await env.start();
    await env.approvedPlan(env.world.unitA1);
    await env.approvedPlan(env.world.unitA2);
    await env.materialize([env.world.unitA1, env.world.unitA2]);
    periodA1 = await env.periodId(env.world.unitA1, A);
    periodA2 = await env.periodId(env.world.unitA2, A);
    await env.outputEvent(env.world.unitA1, A, B, '300');
    await env.outputEvent(env.world.unitA2, A, B, '300');
    await env
      .post('production-events', {
        unitId: env.world.unitA1,
        startTime: plus(A, HOUR),
        physicalType: 'downtime',
        description: 'still running stop',
      })
      .expect(201);
    await env.lossEvent(env.world.unitA2, plus(A, HOUR), 1);
    await env.settle();
  });
  afterAll(() => env.stop());

  it('queues the period whose run measured an open stop, not the one with closed stops only', async () => {
    const [run] = await env.rows<{ as_of: string | null }>(
      `SELECT cr."input_fingerprint"->>'asOf' AS "as_of"
         FROM "accounting_revisions" ar JOIN "calculation_runs" cr ON cr."id" = ar."current_run_id"
        WHERE ar."period_id" = $1`,
      [periodA1],
    );
    expect(run.as_of).not.toBeNull();
    await env.rows(`DELETE FROM "actuals_jobs" WHERE "state" = 'queued'`);
    await env.app.get(PeriodSweepJob).sweep(new Date(plus(B, 2 * HOUR)));
    const queued = await env.rows<{ period_id: string }>(
      `SELECT "period_id" FROM "actuals_jobs" WHERE "state" = 'queued' AND "request"->>'trigger' = 'period_settled'`,
    );
    const ids = queued.map((row) => row.period_id);
    expect(ids).toContain(periodA1);
    expect(ids).not.toContain(periodA2);
  });
});
