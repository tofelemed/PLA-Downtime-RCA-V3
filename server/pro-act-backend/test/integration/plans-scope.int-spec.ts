import { randomUUID } from 'crypto';
import { PlanVersion } from '../../src/plans/entities/plan-version.entity';
import { ApiError, PlanBody, PlanWorld } from './support/plan-world';
import { bearer, signToken } from './support/test-app';

/**
 * Unit scope on plan writes (WF05): a manager approver whose grant stops at unit A1 creates, generates
 * and approves plans of A1 only; plans of A2 answer 404 (v2 and v1), an A2 unit in a body is 422
 * INVALID_REFERENCE, scenarios (tenant-wide) are 403 TENANT_SCOPE_REQUIRED, and a generation job never
 * writes a plan whose unit left the requester's scope before it ran (UNIT_SCOPE).
 */
describe('plan writes and the unit scope (plan 2.3)', () => {
  const env = new PlanWorld();
  let unitUser = '';
  let planA2: PlanBody;

  beforeAll(async () => {
    await env.start();
    const userId = randomUUID();
    await env.rows(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id)
       VALUES ($1, 'unit approver', $2, 'x', 'Operator', $3)`,
      [userId, `${userId}@test.local`, env.world.tenantA],
    );
    await env.rows(
      `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version)
       VALUES ($1, $2, 'unit', $3, 'manager_approver', 1)`,
      [env.world.tenantA, userId, env.world.unitA1],
    );
    unitUser = signToken(env.app, {
      userId,
      tenantId: env.world.tenantA,
      role: 'Operator',
    });
    planA2 = await env.createPlan({
      unitId: env.world.unitA2,
      name: 'A2 plan',
    });
  });
  afterAll(() => env.stop());

  it('creates, generates and approves plans of its own unit', async () => {
    const plan = await env.createPlan({}, unitUser);
    await env.generate(plan.id, 1, unitUser);
    await env
      .post(
        `production-plans/${plan.id}/approve`,
        { expectedVersion: 1 },
        unitUser,
      )
      .expect(200);
    const list = await env.get('production-plans', unitUser).expect(200);
    const items = list.body as {
      items: PlanBody[];
      scope: { unitIds?: string[] };
    };
    expect(items.items.map((p) => p.id)).toEqual([plan.id]);
    expect(items.scope.unitIds).toEqual([env.world.unitA1]);
  });

  it('refuses a body unit outside its scope (422 INVALID_REFERENCE)', async () => {
    const response = await env
      .post(
        'production-plans',
        env.planBody({ unitId: env.world.unitA2 }),
        unitUser,
      )
      .expect(422);
    expect((response.body as ApiError).code).toBe('INVALID_REFERENCE');
  });

  it('answers 404 for plans of other units (read, preview, generate, approve, new version)', async () => {
    await env.get(`production-plans/${planA2.id}`, unitUser).expect(404);
    const path = `production-plans/${planA2.id}`;
    await env
      .post(`${path}/generate-periods`, { version: 1, preview: true }, unitUser)
      .expect(404);
    await env
      .post(`${path}/generate-periods`, { version: 1 }, unitUser)
      .expect(404);
    await env
      .post(`${path}/approve`, { expectedVersion: 1 }, unitUser)
      .expect(404);
    await env.post(`${path}/versions`, {}, unitUser).expect(404);
    await env
      .patch(`${path}/versions/1`, { headerTarget: '1' }, '"1"', unitUser)
      .expect(404);
  });

  it('refuses tenant-wide scenario writes (403 TENANT_SCOPE_REQUIRED)', async () => {
    const response = await env
      .post('plan-scenarios', { name: 'mine' }, unitUser)
      .expect(403);
    expect((response.body as ApiError).code).toBe('TENANT_SCOPE_REQUIRED');
  });

  it('a job never writes a plan whose unit left the requester scope (UNIT_SCOPE)', async () => {
    const plan = await env.createPlan(
      { validFrom: '2027-03-02T02:30:00Z', validTo: '2027-03-03T02:30:00Z' },
      unitUser,
    );
    const accepted = await env
      .post(
        `production-plans/${plan.id}/generate-periods`,
        { version: 1 },
        unitUser,
      )
      .expect(202);
    // before the worker runs, a tenant-wide planner moves the draft to unit A2
    const draft = await env
      .get(`production-plans/${plan.id}/versions/1`)
      .expect(200);
    await env
      .patch(
        `production-plans/${plan.id}/versions/1`,
        { unitId: env.world.unitA2 },
        `"${(draft.body as PlanVersion).rowVersion}"`,
      )
      .expect(200);
    await env.runJobs();
    const jobId = (accepted.body as { jobId: string }).jobId;
    const job = await env.get(`plan-generation-jobs/${jobId}`).expect(200);
    expect(job.body).toMatchObject({
      state: 'failed',
      errorCode: 'UNIT_SCOPE',
    });
    expect(await env.periods(plan.id, 1)).toEqual([]);
    await env.get(`plan-generation-jobs/${jobId}`, unitUser).expect(404);
  });

  it('v1 writes follow the same scope (404 / 422)', async () => {
    const http = env.http();
    await http
      .put(`/api/production-plans/${planA2.id}`)
      .set(bearer(unitUser))
      .send({ plannedQuantity: 5 })
      .expect(404);
    await env
      .http()
      .delete(`/api/production-plans/${planA2.id}`)
      .set(bearer(unitUser))
      .expect(404);
    const created = await env
      .http()
      .post('/api/production-plans')
      .set(bearer(unitUser))
      .send({
        name: 'v1 plan',
        unitId: env.world.unitA2,
        startDate: '2027-03-01T02:30:00Z',
        endDate: '2027-03-02T02:30:00Z',
      })
      .expect(422);
    expect((created.body as ApiError).code).toBe('INVALID_REFERENCE');
  });
});
