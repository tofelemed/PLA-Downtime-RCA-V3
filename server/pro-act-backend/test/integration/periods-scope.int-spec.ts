import { ActualsJobsService } from '../../src/periods/actuals-jobs.service';
import { A, ActualsWorld, NEXT_DAY } from './support/actuals-world';
import { ApiError, DAY1 } from './support/plan-world';

/**
 * Periods, adjustments, recomputes and reports under the unit scope (WF05): a manager approver whose
 * grant stops at unit A1 reads and writes A1 only — another unit's period, adjustment or job answers 404,
 * a body unit or slice outside the scope is 422 INVALID_REFERENCE, site-wide effects (materializing every
 * unit, external reports) are 403 TENANT_SCOPE_REQUIRED — and a job never computes a period outside the
 * requester's recorded scope (UNIT_SCOPE). Tenant B sees nothing of tenant A.
 */
describe('production periods and the unit scope (plan 2.4)', () => {
  const env = new ActualsWorld();
  let unitUser = '';
  let periodA1 = '';
  let periodA3 = '';
  let sliceA1 = '';
  let sliceA3 = '';

  beforeAll(async () => {
    await env.start();
    const { unitA1, unitA3 } = env.world;
    await env.approvedPlan(unitA1);
    await env.materialize([unitA1, unitA3], DAY1, NEXT_DAY);
    periodA1 = await env.periodId(unitA1, A);
    periodA3 = await env.periodId(unitA3, A);
    sliceA1 = (await env.detail(periodA1)).data.slices[0].id;
    sliceA3 = (await env.detail(periodA3)).data.slices[0].id;
    unitUser = await env.unitUser(unitA1);
  });
  afterAll(() => env.stop());

  it('lists and reads periods of its units only', async () => {
    const list = await env.get('production-periods', unitUser).expect(200);
    const body = list.body as {
      items: Array<{ unitId: string }>;
      scope: { unitIds?: string[] };
    };
    expect(new Set(body.items.map((p) => p.unitId))).toEqual(
      new Set([env.world.unitA1]),
    );
    expect(body.scope.unitIds).toEqual([env.world.unitA1]);
    await env.get(`production-periods/${periodA1}`, unitUser).expect(200);
    await env.get(`production-periods/${periodA3}`, unitUser).expect(404);
  });

  it('recomputes its units only; other units and their jobs are 404', async () => {
    await env
      .post(`production-periods/${periodA3}/recompute`, {}, unitUser)
      .expect(404);
    const own = await env
      .post(`production-periods/${periodA1}/recompute`, {}, unitUser)
      .expect(202);
    await env
      .get(`actuals-jobs/${(own.body as { jobId: string }).jobId}`, unitUser)
      .expect(200);
    const other = await env
      .post(`production-periods/${periodA3}/recompute`, {})
      .expect(202);
    await env
      .get(`actuals-jobs/${(other.body as { jobId: string }).jobId}`, unitUser)
      .expect(404);
    await env.runActuals();
  });

  it('materializes named units of its scope only; every unit needs a tenant-wide grant', async () => {
    const all = await env
      .post(
        'production-periods/materialize',
        { from: DAY1, to: NEXT_DAY },
        unitUser,
      )
      .expect(403);
    expect((all.body as ApiError).code).toBe('TENANT_SCOPE_REQUIRED');
    const other = await env
      .post(
        'production-periods/materialize',
        { unitIds: [env.world.unitA3], from: DAY1, to: NEXT_DAY },
        unitUser,
      )
      .expect(422);
    expect((other.body as ApiError).code).toBe('INVALID_REFERENCE');
    await env.materialize([env.world.unitA1], DAY1, NEXT_DAY, unitUser);
  });

  it('adjusts slices of its units only and cannot decide other units’ adjustments', async () => {
    const body = {
      kind: 'gross',
      quantity: '1',
      basis: 'measured',
      reason: 'r',
      evidenceRef: 'e',
    };
    const foreign = await env
      .post('actuals/adjustments', { ...body, sliceId: sliceA3 }, unitUser)
      .expect(422);
    expect((foreign.body as ApiError).code).toBe('INVALID_REFERENCE');
    await env
      .post('actuals/adjustments', { ...body, sliceId: sliceA1 }, unitUser)
      .expect(201);
    const adminA3 = await env
      .post('actuals/adjustments', { ...body, sliceId: sliceA3 })
      .expect(201);
    const id = (adminA3.body as { id: string }).id;
    await env
      .post(`actuals/adjustments/${id}/approve`, {}, unitUser)
      .expect(404);
    await env.get(`actuals/adjustments/${id}`, unitUser).expect(404);
  });

  it('external reports are site documents: import needs a tenant-wide grant; foreign reports are 404', async () => {
    const report = {
      externalReportId: 'MX-1',
      externalRevision: '1',
      localProductionDate: '2027-03-01',
      utcStart: A,
      utcEnd: NEXT_DAY,
      basis: 'gross',
      sourceStatus: 'COMPLETED',
      lines: [
        { unitId: env.world.unitA3, productId: env.products.p1, gross: '10' },
      ],
    };
    const refused = await env
      .post('external-production-reports', report, unitUser)
      .expect(403);
    expect((refused.body as ApiError).code).toBe('TENANT_SCOPE_REQUIRED');
    await env
      .post('external-production-reports/import', { csv: 'x' }, unitUser)
      .expect(403);
    const created = await env
      .post('external-production-reports', report)
      .expect(201);
    const id = (created.body as { id: string }).id;
    await env.get(`external-production-reports/${id}`, unitUser).expect(404);
    await env.get(`external-production-reports/${id}`, env.adminB).expect(404);
    const badUnit = await env
      .post('external-production-reports', {
        ...report,
        externalRevision: '2',
        lines: [{ ...report.lines[0], unitId: env.world.unitB1 }],
      })
      .expect(422);
    expect((badUnit.body as ApiError).code).toBe('INVALID_REFERENCE');
  });

  it('a job keeps the requester’s unit scope', async () => {
    const jobs = env.app.get(ActualsJobsService);
    const queued = await jobs.enqueue(env.harness.dataSource.manager, {
      tenantId: env.world.tenantA,
      unitIds: null,
      from: new Date(DAY1),
      to: new Date(NEXT_DAY),
      trigger: 'test',
      scopeUnitIds: [env.world.unitA1],
      requestedBy: null,
    });
    expect(queued).toBe(3);
    await env.runActuals();
    const [job] = await env.rows<{ id: string }>(
      `INSERT INTO actuals_jobs (tenant_id, row_version, kind, state, period_id, request)
       VALUES ($1, 1, 'recompute', 'queued', $2, $3::jsonb) RETURNING id`,
      [
        env.world.tenantA,
        periodA3,
        JSON.stringify({ trigger: 'test', scopeUnitIds: [env.world.unitA1] }),
      ],
    );
    await env.runActuals();
    const failed = await env.get(`actuals-jobs/${job.id}`).expect(200);
    expect(failed.body).toMatchObject({
      state: 'failed',
      errorCode: 'UNIT_SCOPE',
    });
  });

  it('tenant B sees nothing of tenant A', async () => {
    await env.get(`production-periods/${periodA1}`, env.adminB).expect(404);
    const list = await env.get('production-periods', env.adminB).expect(200);
    expect((list.body as { items: unknown[] }).items).toEqual([]);
    await env
      .post(`production-periods/${periodA1}/recompute`, {}, env.adminB)
      .expect(404);
    await env.get('production-periods?tenantId=x').expect(400);
  });
});
