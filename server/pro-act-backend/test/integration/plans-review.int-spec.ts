import {
  ApiError,
  PlanBody,
  PlanWorld,
  VersionBody,
} from './support/plan-world';

interface ReviewBody {
  submittedBy: string | null;
  submittedAt: string | null;
  returnedBy: string | null;
  returnedAt: string | null;
  returnReason: string | null;
}

/**
 * Review of a plan's open version before approval (the v1 "submit for review / reject with a reason",
 * on v2): the author submits a draft, a manager approver who is not the author returns it with a
 * reason, the plan carries who did what, and the version can then be changed, resubmitted and approved.
 */
describe('production plans v2: submit and return for review', () => {
  const env = new PlanWorld();
  let plan: PlanBody;

  beforeAll(() => env.start());
  afterAll(() => env.stop());

  const review = async (): Promise<ReviewBody> =>
    (
      (await env.get(`production-plans/${plan.id}`).expect(200)).body as {
        review: ReviewBody;
      }
    ).review;

  it('the author submits the draft; the plan records the submission', async () => {
    plan = await env.createPlan();
    const response = await env
      .post(`production-plans/${plan.id}/submit`, { expectedVersion: 1 })
      .expect(200);
    expect((response.body as VersionBody).approvalState).toBe('submitted');
    const again = await env
      .post(`production-plans/${plan.id}/submit`, { expectedVersion: 1 })
      .expect(200);
    expect((again.body as VersionBody).approvalState).toBe('submitted');
    const stored = await review();
    expect(stored.submittedBy).not.toBeNull();
    expect(stored.submittedAt).not.toBeNull();
    expect(stored.returnReason).toBeNull();
    const [header] = await env.rows<{ approval_status: string }>(
      `SELECT approval_status FROM production_plans WHERE id = $1`,
      [plan.id],
    );
    expect(header.approval_status).toBe('Pending Approval');
  });

  it('refuses a return without a reason (422), by an engineer (403) and by the author (403 SEPARATION_OF_DUTIES)', async () => {
    await env
      .post(
        `production-plans/${plan.id}/return`,
        { expectedVersion: 1 },
        env.approver,
      )
      .expect(422);
    await env
      .post(
        `production-plans/${plan.id}/return`,
        { expectedVersion: 1, reason: 'x' },
        env.analyst,
      )
      .expect(403);
    const own = await env
      .post(`production-plans/${plan.id}/return`, {
        expectedVersion: 1,
        reason: 'x',
      })
      .expect(403);
    expect((own.body as ApiError).code).toBe('SEPARATION_OF_DUTIES');
  });

  it('a second manager returns it with a reason: draft again, the reason kept for the author', async () => {
    const response = await env
      .post(
        `production-plans/${plan.id}/return`,
        { expectedVersion: 1, reason: 'Target too high for November' },
        env.approver,
      )
      .expect(200);
    expect((response.body as VersionBody).approvalState).toBe('draft');
    const stored = await review();
    expect(stored).toMatchObject({
      returnReason: 'Target too high for November',
    });
    expect(stored.returnedBy).not.toBeNull();
    expect(stored.returnedAt).not.toBeNull();
    const again = await env
      .post(
        `production-plans/${plan.id}/return`,
        { expectedVersion: 1, reason: 'twice' },
        env.approver,
      )
      .expect(409);
    expect((again.body as ApiError).code).toBe('INVALID_TRANSITION');
  });

  it('resubmitting clears the reason; the submitted version is still approved as before', async () => {
    await env
      .post(`production-plans/${plan.id}/submit`, { expectedVersion: 1 })
      .expect(200);
    expect((await review()).returnReason).toBeNull();
    await env.generate(plan.id, 1);
    const approved = await env
      .post(
        `production-plans/${plan.id}/approve`,
        { expectedVersion: 1 },
        env.approver,
      )
      .expect(200);
    expect((approved.body as VersionBody).approvalState).toBe('approved');
    const late = await env
      .post(`production-plans/${plan.id}/submit`, { expectedVersion: 1 })
      .expect(409);
    expect((late.body as ApiError).code).toBe('INVALID_TRANSITION');
  });

  it('a plan of another tenant is not found', async () => {
    await env
      .post(
        `production-plans/${plan.id}/submit`,
        { expectedVersion: 1 },
        env.adminB,
      )
      .expect(404);
  });
});
