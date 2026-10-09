import {
  A,
  ActualsWorld,
  HOUR,
  NEXT_DAY,
  SliceActualsBody,
} from './support/actuals-world';
import { ApiError, DAY1 } from './support/plan-world';

const plus = (iso: string, ms: number) =>
  new Date(Date.parse(iso) + ms).toISOString();

interface ReportBody {
  id: string;
  state: string;
  outcome?: string;
  certifiedEligible: boolean;
  supersededById: string | null;
}

/**
 * Plan 2.4 steps 3–5: output-event changes recalculate through the outbox; loss-explanation changes and
 * unchanged inputs reuse the current actuals result while an approved adjustment writes a new run (T44
 * separation); adjustments need an independent approver; external daily-production records are the
 * authority of daily periods when the policy says so, a later revision supersedes (never summed), only
 * good known leaves gross null, uncertified records are not used, CSV files import as a job.
 */
describe('actuals adjustments, recalculation triggers and external reports (plan 2.4)', () => {
  const env = new ActualsWorld();
  let periodA1 = '';
  let periodA2 = '';
  let sliceA1 = '';
  let planA1 = '';

  const actualsOf = async (periodId: string): Promise<SliceActualsBody> => {
    const detail = await env.detail(periodId);
    const actuals = detail.data.slices[0]?.actuals;
    if (!actuals) throw new Error('slice without actuals');
    return actuals;
  };
  const settle = async () => {
    await env.relay();
    await env.runActuals();
  };

  beforeAll(async () => {
    await env.start();
    const { unitA1, unitA2 } = env.world;
    planA1 = (await env.approvedPlan(unitA1)).id;
    await env.dailyCalendar(unitA2);
    await env.approvedPlan(unitA2);
    await env.unitPolicy(unitA2, 'source_authority', {
      measurement: 'output',
      productId: null,
      primarySource: 'external_report',
      fallback: null,
      cadenceSeconds: 60,
      conflictTolerance: 0,
      overrideRole: 'integration_admin',
    });
    await env.materialize([unitA1, unitA2], DAY1, NEXT_DAY);
    periodA1 = await env.periodId(unitA1, A);
    periodA2 = await env.periodId(unitA2, A);
    sliceA1 = (await env.detail(periodA1)).data.slices[0].id;
    await settle();
  });
  afterAll(() => env.stop());

  it('a daily-leaf unit has one period per operational day (D03)', async () => {
    const rows = await env.rows<{ utc_end: Date }>(
      `SELECT utc_end FROM production_periods WHERE unit_id = $1`,
      [env.world.unitA2],
    );
    expect(rows.map((row) => row.utc_end.toISOString())).toEqual([NEXT_DAY]);
  });

  it('an output event change recalculates the period through the outbox', async () => {
    await env.outputEvent(
      env.world.unitA1,
      plus(A, HOUR),
      plus(A, 3 * HOUR),
      '50',
    );
    await settle();
    const actuals = await actualsOf(periodA1);
    expect(actuals).toMatchObject({ gross: '50', method: 'output_events' });
  });

  it('T44: loss-explanation changes and unchanged inputs reuse the same actuals result', async () => {
    const before = await env.detail(periodA1);
    await env
      .post('production-events', {
        unitId: env.world.unitA1,
        startTime: plus(A, 4 * HOUR),
        endTime: plus(A, 5 * HOUR),
        physicalType: 'downtime',
        description: 'screw change',
      })
      .expect(201);
    await settle();
    await env.post(`production-periods/${periodA1}/recompute`, {}).expect(202);
    await env.runActuals();
    const jobs = await env.rows<{ result: { reused: boolean } }>(
      `SELECT result FROM actuals_jobs WHERE period_id = $1 AND request->>'trigger' = 'manual_recompute'`,
      [periodA1],
    );
    expect(jobs[0].result.reused).toBe(true);
    const after = await env.detail(periodA1);
    expect(after.data.currentActualsRunId).toBe(
      before.data.currentActualsRunId,
    );
    expect(after.data.slices[0].actuals?.resultId).toBe(
      before.data.slices[0].actuals?.resultId,
    );
  });

  it('T44: an approved adjustment needs an independent approver and writes a new, separate actuals run', async () => {
    const before = await env.detail(periodA1);
    const proposed = await env
      .post('actuals/adjustments', {
        sliceId: sliceA1,
        kind: 'gross',
        quantity: '5',
        basis: 'estimated',
        reason: 'weighbridge ticket not booked in PI',
        evidenceRef: 'WB-2027-0301-17',
      })
      .expect(201);
    const id = (proposed.body as { id: string }).id;
    const own = await env
      .post(`actuals/adjustments/${id}/approve`, {})
      .expect(403);
    expect((own.body as ApiError).code).toBe('SEPARATION_OF_DUTIES');
    await env
      .post(`actuals/adjustments/${id}/approve`, {}, env.approver)
      .expect(200);
    await env
      .post(`actuals/adjustments/${id}/approve`, {}, env.approver)
      .expect(409);
    await settle();
    const after = await env.detail(periodA1);
    expect(after.data.currentActualsRunId).not.toBe(
      before.data.currentActualsRunId,
    );
    expect(after.data.slices[0].actuals).toMatchObject({
      gross: '55',
      method: 'mixed',
      measuredQty: '50',
      estimatedQty: '5',
      adjustmentIds: [id],
    });
    const runs = await env.rows(
      `SELECT 1 FROM actuals_runs WHERE period_id = $1`,
      [periodA1],
    );
    expect(runs).toHaveLength(2);
    const kept = await env.rows(`SELECT 1 FROM actuals_results WHERE id = $1`, [
      before.data.slices[0].actuals?.resultId,
    ]);
    expect(kept).toHaveLength(1);
  });

  it('a rejected adjustment needs a reason and changes nothing', async () => {
    const runBefore = (await env.detail(periodA1)).data.currentActualsRunId;
    const proposed = await env
      .post('actuals/adjustments', {
        sliceId: sliceA1,
        kind: 'reject',
        quantity: '2',
        basis: 'measured',
        reason: 'off-spec bags',
        evidenceRef: 'QC-17',
      })
      .expect(201);
    const id = (proposed.body as { id: string }).id;
    await env
      .post(`actuals/adjustments/${id}/reject`, {}, env.approver)
      .expect(422);
    const rejected = await env.post(
      `actuals/adjustments/${id}/reject`,
      { reason: 'duplicate of QC-16' },
      env.approver,
    );
    expect(rejected.status).toBe(200);
    expect(rejected.body).toMatchObject({
      state: 'rejected',
      decisionReason: 'duplicate of QC-16',
    });
    await settle();
    expect((await env.detail(periodA1)).data.currentActualsRunId).toBe(
      runBefore,
    );
  });

  it('refuses a measurement window outside the slice and foreign slices', async () => {
    const base = {
      kind: 'gross',
      quantity: '1',
      basis: 'measured',
      reason: 'r',
      evidenceRef: 'e',
    };
    const outside = await env
      .post('actuals/adjustments', {
        ...base,
        sliceId: sliceA1,
        windowFrom: plus(A, -HOUR),
        windowTo: A,
      })
      .expect(422);
    expect((outside.body as ApiError).code).toBe('INVALID_RANGE');
    const foreign = await env
      .post('actuals/adjustments', { ...base, sliceId: sliceA1 }, env.adminB)
      .expect(422);
    expect((foreign.body as ApiError).code).toBe('INVALID_REFERENCE');
  });

  const report = (
    revision: string,
    overrides: Record<string, unknown> = {},
  ) => ({
    externalReportId: 'MX-DP-2027-03-01',
    externalRevision: revision,
    localProductionDate: '2027-03-01',
    utcStart: A,
    utcEnd: NEXT_DAY,
    basis: 'gross',
    sourceStatus: 'COMPLETED',
    evidenceRef: 'maximo://dp/2027-03-01',
    lines: [
      {
        unitId: env.world.unitA2,
        productId: env.products.p1,
        gross: '1000',
        reject: '10',
        uom: 't',
      },
    ],
    ...overrides,
  });

  it('a certified external record is the authority of a daily period (ACT08)', async () => {
    const created = await env
      .post('external-production-reports', report('1'))
      .expect(201);
    expect(created.body).toMatchObject({
      outcome: 'imported',
      certifiedEligible: true,
      state: 'current',
    });
    await settle();
    expect(await actualsOf(periodA2)).toMatchObject({
      gross: '1000',
      reject: '10',
      good: '990',
      method: 'external_report',
      coverageRatio: '1',
      qualityState: 'complete',
    });
  });

  it('revision 2 supersedes revision 1 (never summed); only good known → gross null', async () => {
    const first = await env.rows<{ id: string }>(
      `SELECT id FROM external_production_reports WHERE external_revision = '1'`,
    );
    const lines = [
      {
        unitId: env.world.unitA2,
        productId: env.products.p1,
        good: '950',
        uom: 't',
      },
    ];
    const second = await env
      .post(
        'external-production-reports',
        report('2', { basis: 'good', lines }),
      )
      .expect(201);
    const old = await env
      .get(`external-production-reports/${first[0].id}`)
      .expect(200);
    expect(old.body).toMatchObject({
      state: 'superseded',
      supersededById: (second.body as ReportBody).id,
    });
    await settle();
    expect(await actualsOf(periodA2)).toMatchObject({
      gross: null,
      good: '950',
      basis: 'good',
      reject: null,
    });
  });

  it('dedupes on report id + revision; a late lower revision is stored superseded', async () => {
    const lines = [
      {
        unitId: env.world.unitA2,
        productId: env.products.p1,
        good: '950',
        uom: 't',
      },
    ];
    const again = await env
      .post(
        'external-production-reports',
        report('2', { basis: 'good', lines }),
      )
      .expect(201);
    expect((again.body as ReportBody).outcome).toBe('duplicate');
    const changed = await env
      .post('external-production-reports', report('2'))
      .expect(409);
    expect((changed.body as ApiError).code).toBe('REPORT_REVISION_CONFLICT');
    const late = await env
      .post('external-production-reports', report('0'))
      .expect(201);
    expect(late.body).toMatchObject({ outcome: 'stale', state: 'superseded' });
    await settle();
    expect((await actualsOf(periodA2)).good).toBe('950');
  });

  it('an uncertified status is not used; a CSV file imports as a job', async () => {
    const draft = await env
      .post(
        'external-production-reports',
        report('3', { sourceStatus: 'DRAFT' }),
      )
      .expect(201);
    expect((draft.body as ReportBody).certifiedEligible).toBe(false);
    await settle();
    expect(await actualsOf(periodA2)).toMatchObject({
      gross: null,
      good: null,
      qualityState: 'missing',
    });

    const csv =
      'externalReportId,externalRevision,localProductionDate,utcStart,utcEnd,basis,sourceStatus,unitId,productId,gross,uom\n' +
      `MX-DP-2027-03-01,4,2027-03-01,${A},${NEXT_DAY},gross,RELEASED,${env.world.unitA2},${env.products.p1},1100,t\n`;
    const accepted = await env
      .post('external-production-reports/import', { csv })
      .expect(202);
    await env.runActuals();
    const job = await env
      .get(`actuals-jobs/${(accepted.body as { jobId: string }).jobId}`)
      .expect(200);
    expect(job.body).toMatchObject({
      kind: 'report_import',
      state: 'completed',
      result: { imported: 1, problems: [] },
    });
    await settle();
    expect((await actualsOf(periodA2)).gross).toBe('1100');
  });

  it('a new baseline plan version re-resolves open periods; adjustments follow the product slice', async () => {
    const before = await env.detail(periodA1);
    await env
      .post(`production-plans/${planA1}/versions`, {
        headerTarget: '900',
        changeReason: 'rebaseline',
      })
      .expect(201);
    await env.generate(planA1, 2);
    await env
      .post(`production-plans/${planA1}/approve`, { expectedVersion: 2 })
      .expect(200);
    await settle();
    const after = await env.detail(periodA1);
    expect(after.data.slices).toHaveLength(1);
    expect(after.data.slices[0].id).not.toBe(sliceA1);
    expect(after.data.currentActualsRunId).not.toBe(
      before.data.currentActualsRunId,
    );
    expect(after.data.slices[0].actuals).toMatchObject({
      gross: '55',
      method: 'mixed',
    });
    const retired = await env.rows<{ superseded_at: Date | null }>(
      `SELECT superseded_at FROM period_product_slices WHERE id = $1`,
      [sliceA1],
    );
    expect(retired[0].superseded_at).not.toBeNull();
  });
});
