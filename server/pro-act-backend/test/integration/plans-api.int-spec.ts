import {
  ApiError,
  DAY1,
  DAY2,
  PlanBody,
  PlanWorld,
  PreviewBody,
  VersionBody,
} from './support/plan-world';

const sum = (values: string[]) =>
  values.reduce((acc, v) => acc + Math.round(Number(v) * 1e8), 0) / 1e8;

/**
 * Plan 2.3 through the v2 API: a plan is created with draft version 1, previewed (nothing stored),
 * generated as a 202 job with exact targets, approved once its periods exist, and PLAN04 holds — no two
 * approved versions of one scenario plan the same unit and product in overlapping time; another scenario
 * may; one accounting baseline per tenant; a change after approval is a new version, the superseded
 * version's periods stay frozen and an outbox message carries the restatement hint.
 */
describe('production plans v2: versions, generation, approval (plan 2.3)', () => {
  const env = new PlanWorld();
  let plan: PlanBody;
  let firstPeriods: string[] = [];

  beforeAll(() => env.start());
  afterAll(() => env.stop());

  it('creates a plan with draft version 1 in the baseline scenario', async () => {
    plan = await env.createPlan();
    expect(plan.currentVersion).toBe(1);
    expect(plan.version).toMatchObject({
      version: 1,
      approvalState: 'draft',
      headerTarget: '1000',
    });
    const [baseline] = await env.rows<{ id: string }>(
      `SELECT id FROM plan_scenarios WHERE tenant_id = $1 AND is_accounting_baseline`,
      [env.world.tenantA],
    );
    expect(plan.scenarioId).toBe(baseline.id);
  });

  it('previews exact targets by scheduled capacity without storing anything (PLAN03)', async () => {
    const response = await env
      .post(`production-plans/${plan.id}/generate-periods`, {
        version: 1,
        preview: true,
      })
      .expect(200);
    const preview = response.body as PreviewBody;
    expect(
      preview.periods.map((p) => [
        p.shiftName,
        p.target,
        p.sustainedCapacityQty,
      ]),
    ).toEqual([
      ['A', '333.33333333', '800'],
      ['B', '333.33333333', '800'],
      ['C', '333.33333334', '800'],
    ]);
    expect(preview.periods[0]).toMatchObject({
      utcStart: '2027-03-01T02:30:00.000Z',
      utcEnd: '2027-03-01T10:30:00.000Z',
      localDate: '2027-03-01',
      scheduledSeconds: 28800,
    });
    expect(preview.totals).toEqual([{ quantityUom: 't', target: '1000' }]);
    expect(await env.periods(plan.id, 1)).toEqual([]);
  });

  it('refuses approval before the periods are generated', async () => {
    const response = await env
      .post(`production-plans/${plan.id}/approve`, { expectedVersion: 1 })
      .expect(409);
    expect((response.body as ApiError).code).toBe('PERIODS_NOT_GENERATED');
  });

  it('generates the periods as a 202 job; Σ targets = header exactly', async () => {
    const jobId = await env.generate(plan.id, 1);
    const job = await env.get(`plan-generation-jobs/${jobId}`).expect(200);
    expect(job.body).toMatchObject({
      state: 'completed',
      result: { periods: 3, headerTarget: '1000' },
    });
    const periods = await env.periods(plan.id, 1);
    firstPeriods = periods.map((p) => p.target);
    expect(sum(firstPeriods)).toBe(1000);
    const [exact] = await env.rows<{ total: string }>(
      `SELECT SUM(target)::text AS total FROM plan_periods p JOIN plan_versions v ON v.id = p.plan_version_id
        WHERE v.plan_id = $1`,
      [plan.id],
    );
    expect(exact.total).toBe('1000.00000000');
  });

  it('only a manager approver approves; the approval writes the header from the identity', async () => {
    await env
      .post(
        `production-plans/${plan.id}/approve`,
        { expectedVersion: 1 },
        env.analyst,
      )
      .expect(403);
    const own = await env
      .post(`production-plans/${plan.id}/approve`, { expectedVersion: 1 })
      .expect(403);
    expect((own.body as ApiError).code).toBe('SEPARATION_OF_DUTIES');
    const response = await env
      .post(
        `production-plans/${plan.id}/approve`,
        { expectedVersion: 1, reason: 'November baseline' },
        env.approver,
      )
      .expect(200);
    expect(response.body).toMatchObject({
      approvalState: 'approved',
      changeReason: 'November baseline',
    });
    const [header] = await env.rows<{
      approval_status: string;
      approved_at: Date | null;
    }>(
      `SELECT approval_status, approved_at FROM production_plans WHERE id = $1`,
      [plan.id],
    );
    expect(header.approval_status).toBe('Approved');
    expect(header.approved_at).not.toBeNull();
  });

  it('refuses an overlapping approved version in the same scenario (PLAN04, 409)', async () => {
    const second = await env.createPlan({ name: 'overlapping' });
    await env.generate(second.id, 1);
    const response = await env
      .post(
        `production-plans/${second.id}/approve`,
        { expectedVersion: 1 },
        env.approver,
      )
      .expect(409);
    expect((response.body as ApiError).code).toBe('PLAN_OVERLAP');
    expect((response.body as ApiError).details?.conflicts?.[0]).toMatchObject({
      planId: plan.id,
      version: 1,
    });
  });

  it('allows the same interval in another scenario; exactly one accounting baseline', async () => {
    const budget = await env
      .post('plan-scenarios', { name: 'Budget 2027' })
      .expect(201);
    const other = await env.createPlan({
      name: 'budget plan',
      scenarioId: (budget.body as { id: string }).id,
    });
    await env.generate(other.id, 1);
    await env
      .post(
        `production-plans/${other.id}/approve`,
        { expectedVersion: 1 },
        env.approver,
      )
      .expect(200);
    await env
      .post('plan-scenarios', { name: 'Forecast', isAccountingBaseline: true })
      .expect(201);
    const baselines = await env.rows<{ name: string }>(
      `SELECT name FROM plan_scenarios WHERE tenant_id = $1 AND is_accounting_baseline`,
      [env.world.tenantA],
    );
    expect(baselines.map((b) => b.name)).toEqual(['Forecast']);
    await expect(
      env.rows(
        `INSERT INTO plan_scenarios (tenant_id, name, is_accounting_baseline, row_version) VALUES ($1, 'x', true, 1)`,
        [env.world.tenantA],
      ),
    ).rejects.toThrow(/UQ_plan_scenarios_tenant_baseline/);
    const list = await env.get('plan-scenarios').expect(200);
    expect((list.body as { items: unknown[] }).items).toHaveLength(3);
    await env.post('plan-scenarios', { name: 'Budget 2027' }).expect(409);
  });

  it('a change after approval is a new version; the superseded periods stay frozen', async () => {
    const created = await env
      .post(`production-plans/${plan.id}/versions`, {
        headerTarget: '1200',
        changeReason: 'more demand',
      })
      .expect(201);
    expect(created.body).toMatchObject({
      version: 2,
      approvalState: 'draft',
      headerTarget: '1200',
    });
    await env.post(`production-plans/${plan.id}/versions`, {}).expect(409);
    await env.generate(plan.id, 2);
    const approved = await env
      .post(
        `production-plans/${plan.id}/approve`,
        { expectedVersion: 2 },
        env.approver,
      )
      .expect(200);
    const v2 = approved.body as VersionBody;
    expect(v2.approvalState).toBe('approved');
    const v1 = await env
      .get(`production-plans/${plan.id}/versions/1`)
      .expect(200);
    expect(v1.body).toMatchObject({ approvalState: 'superseded' });
    expect((await env.periods(plan.id, 1)).map((p) => p.target)).toEqual(
      firstPeriods,
    );
    expect(sum((await env.periods(plan.id, 2)).map((p) => p.target))).toBe(
      1200,
    );
    const messages = await env.rows<{ payload: Record<string, unknown> }>(
      `SELECT payload FROM outbox WHERE type = 'PlanVersionApproved' AND aggregate_id = $1 ORDER BY version`,
      [plan.id],
    );
    expect(messages.map((m) => m.payload.restatementRequired)).toEqual([
      false,
      true,
    ]);
    expect(messages[1].payload).toMatchObject({
      supersededVersion: 1,
      version: 2,
    });
    await expect(
      env.rows(
        `UPDATE plan_periods SET target = 1 WHERE plan_version_id = (SELECT id FROM plan_versions WHERE plan_id = $1 AND version = 1)`,
        [plan.id],
      ),
    ).rejects.toThrow(/frozen/);
    await expect(
      env.rows(`DELETE FROM plan_versions WHERE plan_id = $1 AND version = 1`, [
        plan.id,
      ]),
    ).rejects.toThrow(/never deleted/);
    // a calendar regeneration may drop the instance: the frozen period keeps its copied bounds
    const [first] = await env.rows<{ shift_instance_id: string }>(
      `SELECT shift_instance_id FROM plan_periods WHERE plan_version_id =
         (SELECT id FROM plan_versions WHERE plan_id = $1 AND version = 1) ORDER BY utc_start LIMIT 1`,
      [plan.id],
    );
    await env.rows(`DELETE FROM shift_instances WHERE id = $1`, [
      first.shift_instance_id,
    ]);
    const kept = await env.periods(plan.id, 1);
    expect(kept.map((p) => p.target)).toEqual(firstPeriods);
    expect(kept[0]).toMatchObject({
      shiftInstanceId: null,
      utcStart: '2027-03-01T02:30:00.000Z',
    });
  });

  it('rate (forecast) changes after approval never alter the approved periods', async () => {
    const before = (await env.periods(plan.id, 2)).map((p) => [
      p.target,
      p.sustainedCapacityQty,
    ]);
    const profileId =
      env.profiles.get(`${env.world.unitA1}:${env.products.p1}`) ?? '';
    const rate = await env
      .post(`profiles/${profileId}/rates`, {
        rateKind: 'planning',
        rate: '120',
        timebase: 'h',
        effectiveFrom: '2027-01-01T00:00:00Z',
      })
      .expect(201);
    await env
      .post(
        `rates/${(rate.body as { id: string }).id}/approve`,
        { supersede: true },
        env.approver,
      )
      .expect(200);
    const after = (await env.periods(plan.id, 2)).map((p) => [
      p.target,
      p.sustainedCapacityQty,
    ]);
    expect(after).toEqual(before);
  });

  it('isolates tenants: foreign plans 404, foreign references 422', async () => {
    await env.get(`production-plans/${plan.id}`, env.adminB).expect(404);
    await env
      .post(
        `production-plans/${plan.id}/generate-periods`,
        { version: 2, preview: true },
        env.adminB,
      )
      .expect(404);
    const foreignUnit = await env
      .post('production-plans', env.planBody(), env.adminB)
      .expect(422);
    expect((foreignUnit.body as ApiError).code).toBe('INVALID_REFERENCE');
    const foreignProduct = await env
      .post(
        'production-plans',
        env.planBody({ slices: [{ productId: env.products.pB }] }),
      )
      .expect(422);
    expect((foreignProduct.body as ApiError).code).toBe('INVALID_REFERENCE');
    const list = await env.get('production-plans', env.adminB).expect(200);
    expect((list.body as { items: unknown[] }).items).toEqual([]);
  });

  it('edits drafts with If-Match only; approved versions are not editable', async () => {
    const draft = await env.createPlan({
      validFrom: DAY2,
      validTo: '2027-03-03T02:30:00Z',
    });
    await env
      .patch(
        `production-plans/${draft.id}/versions/1`,
        { headerTarget: '5' },
        '"999"',
      )
      .expect(412);
    const ok = await env
      .patch(
        `production-plans/${draft.id}/versions/1`,
        { headerTarget: '5' },
        `"${draft.version.rowVersion}"`,
      )
      .expect(200);
    expect(ok.body).toMatchObject({
      headerTarget: '5',
      periodsGeneratedAt: null,
    });
    const approved = await env
      .patch(
        `production-plans/${plan.id}/versions/2`,
        { headerTarget: '5' },
        '"1"',
      )
      .expect(409);
    expect((approved.body as ApiError).code).toBe('VERSION_NOT_DRAFT');
    await env
      .post(`production-plans/${plan.id}/generate-periods`, { version: 2 })
      .expect(409);
  });

  it('validates the window and the products', async () => {
    const empty = await env
      .post('production-plans', env.planBody({ validTo: DAY1 }))
      .expect(422);
    expect((empty.body as ApiError).code).toBe('INVALID_PLAN_WINDOW');
    await env
      .post('production-plans', env.planBody({ slices: [] }))
      .expect(422);
    await env
      .post('production-plans', {
        ...env.planBody(),
        tenantId: env.world.tenantB,
      })
      .expect(422);
  });
});
