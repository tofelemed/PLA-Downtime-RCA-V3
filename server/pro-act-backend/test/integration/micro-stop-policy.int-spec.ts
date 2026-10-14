import { randomUUID } from 'crypto';
import { A, B, HOUR } from './support/actuals-world';
import { AccountingWorld, plus } from './support/accounting-world';
import { ApiError } from './support/plan-world';

interface PolicyBody {
  unitId: string | null;
  version: number;
  microStopSeconds: number;
  microStopSecondsByAssetClass: Record<string, number>;
  tripReasonCodes: string[];
}

/**
 * SME D6 on real Postgres: a unit's micro-stop settings as a new oee_policy version (threshold per asset
 * class, trip reasons); a 90 s stop of a bagger (120 s pilot) stays a micro-stop while a 90 s stop without
 * an asset of that class is an availability stop, and a 30 s trip is always a stop.
 */
describe('micro-stop threshold per asset class (SME D6)', () => {
  const env = new AccountingWorld();
  let periodA1 = '';
  const bagger = randomUUID();

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
    await env.rows(
      `INSERT INTO "assets" ("id", "code", "name", "unit_id", "tenant_id", "asset_type")
       VALUES ($1, 'FFS-1', 'FFS bagger', $2, $3, 'Bagger') RETURNING "id"`,
      [bagger, env.world.unitA1, env.world.tenantA],
    );
  });
  afterAll(() => env.stop());

  it('reads the default and writes a unit version with class thresholds and trip reasons', async () => {
    const current = await env
      .get(`micro-stop-policies/current?unitId=${env.world.unitA1}`)
      .expect(200);
    expect(current.body as PolicyBody).toMatchObject({
      unitId: null,
      microStopSeconds: 60,
      microStopSecondsByAssetClass: {},
    });
    const created = await env
      .post('micro-stop-policies', {
        unitId: env.world.unitA1,
        microStopSeconds: 60,
        microStopSecondsByAssetClass: { Bagger: 120 },
        tripReasonCodes: ['PROC-TRIP'],
        notes: 'pilot',
      })
      .expect(201);
    expect(created.body as PolicyBody).toMatchObject({
      unitId: env.world.unitA1,
      microStopSecondsByAssetClass: { Bagger: 120 },
      tripReasonCodes: ['PROC-TRIP'],
    });
    const bad = await env
      .post('micro-stop-policies', {
        unitId: env.world.unitA1,
        microStopSeconds: 60,
        microStopSecondsByAssetClass: { Bagger: -5 },
      })
      .expect(422);
    expect((bad.body as ApiError).code).toBe('INVALID_POLICY');
  });

  it('a 90 s bagger stop is a micro-stop; 90 s without that class and a functional failure are stops', async () => {
    await env.lossEvent(env.world.unitA1, plus(A, HOUR), 90 / 3600, {
      assetId: bagger,
      scheduleClass: 'unplanned',
    });
    await env.lossEvent(env.world.unitA1, plus(A, 2 * HOUR), 90 / 3600, {
      scheduleClass: 'unplanned',
    });
    await env.lossEvent(env.world.unitA1, plus(A, 3 * HOUR), 30 / 3600, {
      assetId: bagger,
      scheduleClass: 'unplanned',
      failureSeverity: 'critical',
    });
    await env.settle();
    expect(await metric('stop_count')).toBe(2);
    expect(await metric('microstop_time')).toBe(90);
  });
});
