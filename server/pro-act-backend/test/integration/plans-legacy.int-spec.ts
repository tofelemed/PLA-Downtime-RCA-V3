import { randomUUID } from 'crypto';
import { ApiError, DAY1, DAY2, PlanWorld } from './support/plan-world';
import { bearer, signToken } from './support/test-app';

interface VersionRow {
  version: number;
  approval_state: string;
  basis: string;
  header_target: string | null;
  generation_error: { code: string } | null;
  total: string | null;
}

/**
 * Plan 2.3 legacy bridge (C4): the v1 plan screens keep working on the version model. A v1 create makes
 * draft version 1 with generated periods (plannedQuantity → quantity basis by scheduled capacity, no
 * 100/h default); a v1 edit of plannedQuantity regenerates the draft; the v1 "Approved" label goes
 * through the approval service (manager approver other than the draft's author; header columns from the
 * identity, not the client);
 * an edit after approval opens version 2 and leaves the approved version untouched; approved plans are
 * not deleted.
 */
describe('v1 production plans on the version model (plan 2.3 legacy bridge)', () => {
  const env = new PlanWorld();
  const adminId = randomUUID();
  const approverId = randomUUID();
  let admin = '';
  let approver = '';
  let planId = '';

  beforeAll(async () => {
    await env.start();
    const sign = (userId: string) =>
      signToken(env.app, {
        userId,
        tenantId: env.world.tenantA,
        role: 'TenantAdmin',
      });
    admin = sign(adminId);
    approver = sign(approverId);
  });
  afterAll(() => env.stop());

  const v1 = () => env.http();
  const versions = () =>
    env.rows<VersionRow>(
      `SELECT v.version, v.approval_state, v.basis, v.header_target::text, v.generation_error,
              (SELECT SUM(p.target)::text FROM plan_periods p WHERE p.plan_version_id = v.id) AS total
         FROM plan_versions v WHERE v.plan_id = $1 ORDER BY v.version`,
      [planId],
    );
  const header = async () =>
    (
      await env.rows<{
        approval_status: string;
        approved_by: string | null;
        current_version: number;
      }>(
        `SELECT approval_status, approved_by, current_version FROM production_plans WHERE id = $1`,
        [planId],
      )
    )[0];

  it('a v1 create makes draft version 1 with generated periods', async () => {
    const created = await v1()
      .post('/api/production-plans')
      .set(bearer(admin))
      .send({
        name: 'v1 plan',
        unitId: env.world.unitA1,
        productId: env.products.p1,
        plannedQuantity: 900,
        startDate: DAY1,
        endDate: DAY2,
        approvedBy: 'someone-else',
      })
      .expect(201);
    planId = (created.body as { id: string }).id;
    expect(await versions()).toEqual([
      expect.objectContaining({
        version: 1,
        approval_state: 'draft',
        basis: 'quantity',
        total: '900.00000000',
      }),
    ]);
    expect(await header()).toMatchObject({
      approval_status: 'Draft',
      approved_by: null,
      current_version: 1,
    });
  });

  it('a v1 edit of plannedQuantity regenerates the draft periods', async () => {
    await v1()
      .put(`/api/production-plans/${planId}`)
      .set(bearer(admin))
      .send({ plannedQuantity: 1200 })
      .expect(200);
    expect(await versions()).toEqual([
      expect.objectContaining({
        version: 1,
        approval_state: 'draft',
        total: '1200.00000000',
      }),
    ]);
  });

  it('the v1 "Approved" label approves through the service (manager approver, not the author)', async () => {
    const denied = await v1()
      .put(`/api/production-plans/${planId}`)
      .set(bearer(env.analyst))
      .send({ approvalStatus: 'Approved' })
      .expect(403);
    expect((denied.body as ApiError).code).toBe('FORBIDDEN_ROLE');
    const own = await v1()
      .put(`/api/production-plans/${planId}`)
      .set(bearer(admin))
      .send({ approvalStatus: 'Approved' })
      .expect(403);
    expect((own.body as ApiError).code).toBe('SEPARATION_OF_DUTIES');
    expect((await versions())[0]).toMatchObject({ approval_state: 'draft' });
    await v1()
      .put(`/api/production-plans/${planId}`)
      .set(bearer(approver))
      .send({ approvalStatus: 'Approved', approvedBy: 'forged' })
      .expect(200);
    expect((await versions())[0]).toMatchObject({ approval_state: 'approved' });
    expect(await header()).toMatchObject({
      approval_status: 'Approved',
      approved_by: approverId,
    });
  });

  it('an edit after approval opens version 2; the approved version is untouched', async () => {
    await v1()
      .put(`/api/production-plans/${planId}`)
      .set(bearer(admin))
      .send({ plannedQuantity: 1500, approvalStatus: 'Approved' })
      .expect(200);
    expect(await versions()).toEqual([
      expect.objectContaining({
        version: 1,
        approval_state: 'approved',
        total: '1200.00000000',
      }),
      expect.objectContaining({
        version: 2,
        approval_state: 'draft',
        total: '1500.00000000',
      }),
    ]);
    expect(await header()).toMatchObject({
      approval_status: 'Draft',
      current_version: 2,
    });
    const listed = await v1()
      .get('/api/production-plans')
      .set(bearer(admin))
      .expect(200);
    expect((listed.body as Array<{ id: string }>).map((p) => p.id)).toContain(
      planId,
    );
  });

  it('approved plans are not deleted; draft-only plans are', async () => {
    const refused = await v1()
      .delete(`/api/production-plans/${planId}`)
      .set(bearer(admin))
      .expect(409);
    expect((refused.body as ApiError).code).toBe('PLAN_APPROVED');
    const draft = await env.createPlan({
      validFrom: DAY2,
      validTo: '2027-03-03T02:30:00Z',
    });
    await v1()
      .delete(`/api/production-plans/${draft.id}`)
      .set(bearer(admin))
      .expect(200);
    const left = await env.rows(
      `SELECT 1 FROM plan_versions WHERE plan_id = $1`,
      [draft.id],
    );
    expect(left).toEqual([]);
  });

  it('a generation refusal is stored on the draft; the v1 save still succeeds', async () => {
    const created = await v1()
      .post('/api/production-plans')
      .set(bearer(admin))
      .send({
        name: 'no rates',
        unitId: env.world.unitA3,
        productId: env.products.p1,
        plannedQuantity: 10,
        startDate: DAY1,
        endDate: DAY2,
      })
      .expect(201);
    planId = (created.body as { id: string }).id;
    expect((await versions())[0]).toMatchObject({
      version: 1,
      generation_error: expect.objectContaining({ code: 'NO_ELIGIBLE_TIME' }),
      total: null,
    });
  });
});
