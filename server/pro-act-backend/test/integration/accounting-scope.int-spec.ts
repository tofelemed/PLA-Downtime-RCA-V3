import { ActualsJobsService } from '../../src/periods/actuals-jobs.service';
import { A, B, NEXT_DAY } from './support/actuals-world';
import { AccountingWorld } from './support/accounting-world';
import { ApiError, DAY1 } from './support/plan-world';

/**
 * Plan 2.5 under the unit scope (WF05) and tenancy: a manager approver limited to unit A1 reads the
 * accounting and runs of A1 only (another unit's period is 404), recalculates named units of its scope
 * only (a foreign or out-of-scope body unit is 422 INVALID_REFERENCE; every unit needs a tenant-wide
 * grant, 403), and a job never writes a calculation run for a period outside the requester's recorded
 * scope (UNIT_SCOPE). Tenant B sees nothing of tenant A.
 */
describe('loss accounting and the unit scope (plan 2.5)', () => {
  const env = new AccountingWorld();
  let unitUser = '';
  let periodA1 = '';
  let periodA3 = '';

  const calculationRuns = async (periodId: string) =>
    (
      await env.rows<{ count: number }>(
        `SELECT count(*)::int AS count FROM calculation_runs WHERE period_id = $1`,
        [periodId],
      )
    )[0].count;

  beforeAll(async () => {
    await env.start();
    const { unitA1, unitA3 } = env.world;
    await env.approvedPlan(unitA1);
    await env.materialize([unitA1, unitA3], DAY1, NEXT_DAY);
    periodA1 = await env.periodId(unitA1, A);
    periodA3 = await env.periodId(unitA3, A);
    await env.outputEvent(unitA3, A, B, '100');
    unitUser = await env.unitUser(unitA1);
  });
  afterAll(() => env.stop());

  it('recalculates named units of its scope only; every unit needs a tenant-wide grant', async () => {
    const window = { from: A, to: B };
    const all = await env
      .post('production-periods/recalculate', window, unitUser)
      .expect(403);
    expect((all.body as ApiError).code).toBe('TENANT_SCOPE_REQUIRED');
    const other = await env
      .post(
        'production-periods/recalculate',
        { ...window, unitIds: [env.world.unitA3] },
        unitUser,
      )
      .expect(422);
    expect((other.body as ApiError).code).toBe('INVALID_REFERENCE');
    const foreign = await env
      .post('production-periods/recalculate', {
        ...window,
        unitIds: [env.world.unitB1],
      })
      .expect(422);
    expect((foreign.body as ApiError).code).toBe('INVALID_REFERENCE');
    const own = await env
      .post(
        'production-periods/recalculate',
        { ...window, unitIds: [env.world.unitA1] },
        unitUser,
      )
      .expect(202);
    expect(own.body).toEqual({ queued: 1 });
    await env.runActuals();
    expect(await calculationRuns(periodA1)).toBe(1);
    expect(await calculationRuns(periodA3)).toBe(0);
  });

  it('refuses an inverted or oversized window and needs a writer role', async () => {
    const inverted = await env
      .post('production-periods/recalculate', {
        from: B,
        to: A,
        unitIds: [env.world.unitA1],
      })
      .expect(422);
    expect((inverted.body as ApiError).code).toBe('INVALID_RANGE');
    const viewer = await env.unitUser(env.world.unitA1, 'viewer');
    await env
      .post(
        'production-periods/recalculate',
        { from: A, to: B, unitIds: [env.world.unitA1] },
        viewer,
      )
      .expect(403);
  });

  it('reads accounting and runs of its units only', async () => {
    await env.recompute(periodA3);
    await env.accounting(periodA1, unitUser);
    await env.runs(periodA1, unitUser);
    await env
      .get(`production-periods/${periodA3}/accounting`, unitUser)
      .expect(404);
    await env.get(`production-periods/${periodA3}/runs`, unitUser).expect(404);
  });

  it('a job keeps the requester’s unit scope: no calculation run outside it', async () => {
    const before = await calculationRuns(periodA3);
    const [job] = await env.rows<{ id: string }>(
      `INSERT INTO actuals_jobs (tenant_id, row_version, kind, state, period_id, request)
       VALUES ($1, 1, 'recompute', 'queued', $2, $3::jsonb) RETURNING id`,
      [
        env.world.tenantA,
        periodA3,
        JSON.stringify({ trigger: 'test', scopeUnitIds: [env.world.unitA1] }),
      ],
    );
    await env.app.get(ActualsJobsService).runPending();
    const failed = await env.get(`actuals-jobs/${job.id}`).expect(200);
    expect(failed.body).toMatchObject({
      state: 'failed',
      errorCode: 'UNIT_SCOPE',
    });
    expect(await calculationRuns(periodA3)).toBe(before);
  });

  it('tenant B sees nothing of tenant A; tenantId in the query is refused', async () => {
    await env
      .get(`production-periods/${periodA1}/accounting`, env.adminB)
      .expect(404);
    await env
      .get(`production-periods/${periodA1}/runs`, env.adminB)
      .expect(404);
    await env
      .post(
        'production-periods/recalculate',
        { from: A, to: B, unitIds: [env.world.unitA1] },
        env.adminB,
      )
      .expect(422);
    await env
      .get(`production-periods/${periodA1}/accounting?tenantId=x`)
      .expect(400);
  });
});
