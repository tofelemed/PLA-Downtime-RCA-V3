import { randomUUID } from 'crypto';
import { PeriodSweepJob } from '../../src/periods/period-sweep.job';
import { A, B, HOUR, SignalSpec } from './support/actuals-world';
import { AccountingWorld, plus } from './support/accounting-world';

const MINUTE = 60_000;

interface KpiRow {
  value: string | null;
  numerator: string | null;
  denominator: string | null;
  reason: string | null;
  cohort: Record<string, unknown> | null;
}

/**
 * Area 2 leftovers on real Postgres: reliability inputs request their own recalculation (CMMS operations,
 * standby duties and runs, state mappings through the outbox; late state samples through the sweep), a
 * standby asset's MTBF uses its own running time (SME D9, KPI 2.7.7), and re-typing an asset changes the
 * run input hash so a recompute writes a new run instead of keeping the old one.
 */
describe('reliability inputs recalculate their periods (Area 2)', () => {
  const env = new AccountingWorld();
  let periodA1 = '';
  const pump = randomUUID();
  const spare = randomUUID();

  const kpi = async (metric: string, assetId?: string): Promise<KpiRow> => {
    const [row] = await env.rows<KpiRow>(
      `SELECT k."value"::text AS "value", k."numerator"::text AS "numerator",
              k."denominator"::text AS "denominator", k."reason", k."cohort"
         FROM "kpi_results" k JOIN "accounting_revisions" ar ON ar."current_run_id" = k."run_id"
        WHERE ar."period_id" = $1 AND k."metric" = $2
          AND k."scope"->>'level' = $3 AND ($4::text IS NULL OR k."scope"->>'assetId' = $4)`,
      [periodA1, metric, assetId ? 'asset' : 'period', assetId ?? null],
    );
    return row;
  };

  const currentRun = async () => {
    const [row] = await env.rows<{ id: string; input_hash: string }>(
      `SELECT cr."id", cr."input_hash" FROM "accounting_revisions" ar
         JOIN "calculation_runs" cr ON cr."id" = ar."current_run_id" WHERE ar."period_id" = $1`,
      [periodA1],
    );
    return row;
  };

  const recalcRequests = (reason: string) =>
    env.rows<{ n: number }>(
      `SELECT count(*)::int AS "n" FROM "outbox"
        WHERE "type" = 'PeriodRecalculateRequested' AND "payload"->>'reason' = $1`,
      [reason],
    );

  beforeAll(async () => {
    await env.start();
    await env.approvedPlan(env.world.unitA1);
    await env.materialize([env.world.unitA1]);
    periodA1 = await env.periodId(env.world.unitA1, A);
    await env.outputEvent(env.world.unitA1, A, B, '300');
    await env.rows(
      `INSERT INTO "assets" ("id", "code", "name", "unit_id", "tenant_id", "asset_type") VALUES
         ($1, 'P-501', 'Feed pump', $3, $4, 'Pump'), ($2, 'P-502', 'Spare feed pump', $3, $4, 'Pump')`,
      [pump, spare, env.world.unitA1, env.world.tenantA],
    );
    await env.settle();
  });
  afterAll(() => env.stop());

  it('a CMMS import recalculates the period of the repaired stop (no other change needed)', async () => {
    await env.lossEvent(env.world.unitA1, plus(A, HOUR), 3, {
      assetId: pump,
      scheduleClass: 'unplanned',
      failureMode: 'Bearing failure',
      failureSeverity: 'critical',
    });
    await env.settle();
    expect((await kpi('mttr')).reason).toBe('repair_evidence_missing');
    await env
      .post('work-order-operations/import', {
        operations: [
          {
            workOrderId: 'WO-RECALC',
            operationId: '0010',
            kind: 'repair',
            startedAt: plus(A, 1.5 * HOUR),
            endedAt: plus(A, 2.5 * HOUR),
            assetId: pump,
          },
        ],
      })
      .expect(200);
    expect((await recalcRequests('work_order_operations_imported'))[0].n).toBe(
      1,
    );
    await env.settle();
    expect(Number((await kpi('mttr')).value)).toBe(HOUR / 1000);
  });

  it('a standby duty and its runs give the asset MTBF on its own running time (SME D9)', async () => {
    await env
      .post('standby-equipment', {
        assetId: spare,
        evaluation: 'running',
        effectiveFrom: plus(A, -24 * HOUR),
      })
      .expect(201);
    await env
      .post('standby-records/import', {
        records: [
          {
            assetId: spare,
            kind: 'run',
            startedAt: plus(A, 4 * HOUR),
            endedAt: plus(A, 6 * HOUR),
            outcome: 'success',
            externalRef: 'RUN-RECALC-1',
          },
        ],
      })
      .expect(200);
    await env.lossEvent(env.world.unitA1, plus(A, 5 * HOUR), 0.5, {
      assetId: spare,
      scheduleClass: 'unplanned',
      failureMode: 'Seal leak',
      failureSeverity: 'critical',
    });
    expect((await recalcRequests('standby_duty_changed'))[0].n).toBe(1);
    expect((await recalcRequests('standby_records_imported'))[0].n).toBe(1);
    await env.settle();
    const mtbf = await kpi('mtbf', spare);
    expect(Number(mtbf.numerator)).toBe((2 * HOUR) / 1000);
    expect(Number(mtbf.denominator)).toBe(1);
    expect(mtbf.cohort).toMatchObject({
      exposureBasis: 'asset_running_time',
    });
    expect((await kpi('mtbf', pump)).cohort).toMatchObject({
      exposureBasis: 'unit_run_time',
    });
  });

  it('re-typing an asset changes the input hash: a recompute writes a new run', async () => {
    await env.recompute(periodA1);
    const before = await currentRun();
    await env.recompute(periodA1);
    expect((await currentRun()).id).toBe(before.id);
    await env.rows(
      `UPDATE "assets" SET "asset_type" = 'Agitator' WHERE "id" = $1`,
      [pump],
    );
    await env.recompute(periodA1);
    const after = await currentRun();
    expect(after.id).not.toBe(before.id);
    expect(after.input_hash).not.toBe(before.input_hash);
  });

  it('a state mapping requests a recalculation; late state samples queue the period in the sweep', async () => {
    const signalId = await env.signal({
      unitId: env.world.unitA1,
      semanticType: 'state',
      from: plus(A, -24 * HOUR),
      to: null,
    } as unknown as SignalSpec);
    await env
      .post('unit-state-mappings', {
        unitId: env.world.unitA1,
        signalId,
        rules: [
          { match: '1', state: 'running' },
          { match: '0', state: 'internal_stop' },
        ],
        expectedIntervalSeconds: 600,
        effectiveFrom: plus(A, -60 * MINUTE),
      })
      .expect(201);
    expect((await recalcRequests('unit_state_mapping_changed'))[0].n).toBe(1);
    await env.settle();
    const sweep = () =>
      env.app.get(PeriodSweepJob).sweep(new Date(plus(B, 2 * HOUR)));
    const queued = () =>
      env.rows<{ period_id: string }>(
        `SELECT "period_id" FROM "actuals_jobs" WHERE "state" = 'queued' AND "request"->>'trigger' = 'period_settled'`,
      );
    await env.rows(`DELETE FROM "actuals_jobs" WHERE "state" = 'queued'`);
    await sweep();
    expect((await queued()).map((r) => r.period_id)).not.toContain(periodA1);
    await env.samples(signalId, A, [
      [0, '1'],
      [10, '1'],
    ]);
    await sweep();
    expect((await queued()).map((r) => r.period_id)).toContain(periodA1);
    await env.runActuals();
    await env.rows(`DELETE FROM "actuals_jobs" WHERE "state" = 'queued'`);
    await sweep();
    expect((await queued()).map((r) => r.period_id)).not.toContain(periodA1);
  });
});
