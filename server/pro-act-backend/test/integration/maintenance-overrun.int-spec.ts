import { A, B, HOUR } from './support/actuals-world';
import { AccountingWorld, plus } from './support/accounting-world';
import { ApiError } from './support/plan-world';

/**
 * SME D4 on real Postgres: a planned stop with an approved window 1 h–3 h after shift start that ends at
 * 4 h is 2 h planned + 1 h unplanned maintenance overrun of the same stop (one stop, no failure); the
 * planned end must lie after the start (422 PLANNED_END_BEFORE_START).
 */
describe('maintenance overrun (SME D4)', () => {
  const env = new AccountingWorld();
  let periodA1 = '';

  const metric = async (name: string) => {
    const [row] = await env.rows<{ value: string | null }>(
      `SELECT k."value"::text AS "value" FROM "kpi_results" k
         JOIN "accounting_revisions" ar ON ar."current_run_id" = k."run_id"
        WHERE ar."period_id" = $1 AND k."metric" = $2 AND k."scope"->>'level' = 'period'`,
      [periodA1, name],
    );
    return row?.value === null || row === undefined ? null : Number(row.value);
  };

  beforeAll(async () => {
    await env.start();
    await env.approvedPlan(env.world.unitA1);
    await env.materialize([env.world.unitA1]);
    periodA1 = await env.periodId(env.world.unitA1, A);
    await env.outputEvent(env.world.unitA1, A, B, '300');
  });
  afterAll(() => env.stop());

  it('refuses a planned end before the start', async () => {
    const response = await env
      .post('production-events', {
        unitId: env.world.unitA1,
        startTime: plus(A, HOUR),
        endTime: plus(A, 2 * HOUR),
        physicalType: 'downtime',
        scheduleClass: 'planned',
        plannedEndTime: A,
      })
      .expect(422);
    expect((response.body as ApiError).code).toBe('PLANNED_END_BEFORE_START');
  });

  it('splits the stop at its approved end: planned up to it, unplanned overrun after it', async () => {
    const id = await env.lossEvent(env.world.unitA1, plus(A, HOUR), 3, {
      scheduleClass: 'planned',
      plannedEndTime: plus(A, 3 * HOUR),
    });
    const [stored] = await env.rows<{ planned_end_time: Date }>(
      `SELECT "planned_end_time" FROM "production_events" WHERE "id" = $1`,
      [id],
    );
    expect(new Date(stored.planned_end_time).toISOString()).toBe(
      plus(A, 3 * HOUR),
    );
    await env.settle();
    expect(await metric('downtime_total')).toBe(3 * 3600);
    expect(await metric('downtime_planned')).toBe(2 * 3600);
    expect(await metric('downtime_unplanned')).toBe(3600);
    expect(await metric('downtime_maintenance_overrun')).toBe(3600);
    expect(await metric('stop_count')).toBe(1);
  });
});
