import { A, B, HOUR } from './support/actuals-world';
import { plus } from './support/accounting-world';
import { ApiError, DAY1 } from './support/plan-world';
import {
  ReconciliationBody,
  ReconciliationWorld,
} from './support/reconciliation-world';

/**
 * Plan 2.8 under roles, unit scope and tenancy (WF05, D06): a manager approver limited to unit A1 works on
 * A1 periods only (another unit's period or proposal is 404, never 403), body ids of another tenant or
 * outside the period are 422 INVALID_REFERENCE, viewers and operators cannot write (403), production
 * engineers cannot approve (403), the revise job keeps the requester's unit scope, and tenant B sees
 * nothing of tenant A.
 */
describe('reconciliation workflow and the unit scope (plan 2.8)', () => {
  const env = new ReconciliationWorld();
  let unitUser = '';
  let periodA3 = '';
  let reason = '';

  const manual = (
    view: ReconciliationBody,
    extra: Record<string, unknown> = {},
  ) => ({
    action: 'manual',
    sliceId: view.slices[0].sliceId,
    kind: 'availability',
    quantity: '150',
    missingEvent: true,
    reasonCodeId: reason,
    ...extra,
  });

  beforeAll(async () => {
    await env.start();
    await env.materialize([env.world.unitA3], DAY1, B);
    periodA3 = await env.periodId(env.world.unitA3, A);
    await env.outputEvent(env.world.unitA3, A, B, '500');
    await env.settle();
    unitUser = await env.unitUser(env.world.unitA1);
    reason = await env.reasonCode('FEED');
  });
  afterAll(() => env.stop());

  it('a unit-limited approver reads and writes its unit only; other units are 404', async () => {
    const own = await env.view(env.periodA1, unitUser);
    await env.saveLines(own, [manual(own)], unitUser).expect(200);
    await env
      .get(`production-periods/${periodA3}/reconciliation`, unitUser)
      .expect(404);
    const other = await env.view(periodA3);
    await env.saveLines(other, [], unitUser, periodA3).expect(404);
    await env.submit(other, unitUser, periodA3).expect(404);
    await env
      .get(`production-periods/${periodA3}/approval-actions`, unitUser)
      .expect(404);
  });

  it('body ids of another tenant or outside the period are 422 INVALID_REFERENCE', async () => {
    const view = await env.view(env.periodA1, unitUser);
    const foreignEvent = (
      await env
        .post(
          'production-events',
          {
            unitId: env.world.unitB1,
            startTime: plus(A, HOUR),
            endTime: plus(A, 2 * HOUR),
            physicalType: 'downtime',
            description: 'tenant B stop',
          },
          env.adminB,
        )
        .expect(201)
    ).body as { id: string };
    const sliceA3 = (await env.view(periodA3)).slices[0]?.sliceId;
    const cases = [
      manual(view, {
        missingEvent: undefined,
        reasonCodeId: undefined,
        eventIds: [foreignEvent.id],
      }),
      manual(view, { sliceId: sliceA3 }),
    ];
    for (const line of cases) {
      const response = await env.saveLines(view, [line], unitUser).expect(422);
      expect((response.body as ApiError).code).toBe('INVALID_REFERENCE');
    }
    const foreignRun = await env
      .saveLines(
        { ...view, baseRunId: (await env.view(periodA3)).baseRunId },
        [],
        unitUser,
      )
      .expect(422);
    expect((foreignRun.body as ApiError).code).toBe('INVALID_REFERENCE');
  });

  it('viewers and operators cannot write; production engineers cannot approve', async () => {
    const view = await env.view(env.periodA1);
    const viewer = await env.unitUser(env.world.unitA1, 'viewer');
    const operator = env.user('Operator');
    for (const token of [viewer, operator]) {
      await env.saveLines(view, [], token).expect(403);
      await env.submit(view, token).expect(403);
    }
    await env.view(env.periodA1, viewer);
    const engineer = await env.unitUser(
      env.world.unitA1,
      'production_engineer',
    );
    const submitted = (await env.submit(view, engineer).expect(200))
      .body as ReconciliationBody;
    await env.approve(submitted, engineer).expect(403);
    await env.approve(submitted, unitUser).expect(200);
  });

  it('the revise job keeps the requester’s unit scope', async () => {
    const revised = await env
      .post(
        `production-periods/${env.periodA1}/revise`,
        {
          approvedRevision: 1,
          reason: 'recheck',
        },
        unitUser,
      )
      .expect(201);
    expect((revised.body as ReconciliationBody).revision.revision).toBe(2);
    const [job] = await env.rows<{
      request: { scopeUnitIds: string[] | null; trigger: string };
    }>(
      `SELECT request FROM actuals_jobs WHERE period_id = $1 AND request->>'trigger' = 'revise'`,
      [env.periodA1],
    );
    expect(job.request.scopeUnitIds).toEqual([env.world.unitA1]);
    const wrong = await env
      .post(
        `production-periods/${env.periodA1}/revise`,
        {
          approvedRevision: 2,
          reason: 'x',
        },
        unitUser,
      )
      .expect(409);
    expect((wrong.body as ApiError).code).toBe('REVISION_MISMATCH');
  });

  it('a proposal of another unit is 404; tenant B sees nothing; tenantId in the query is refused', async () => {
    const view = await env.view(periodA3);
    await env.submit(view, env.admin, periodA3).expect(200);
    await env
      .approve(await env.view(periodA3), env.approver, periodA3)
      .expect(200);
    await env.lossEvent(env.world.unitA3, plus(A, HOUR), 1);
    await env.settle();
    const listed = await env
      .get(`production-periods/${periodA3}/change-proposals`)
      .expect(200);
    const [proposal] = (listed.body as { items: Array<{ id: string }> }).items;
    await env.get(`period-change-proposals/${proposal.id}`).expect(200);
    await env
      .get(`period-change-proposals/${proposal.id}`, unitUser)
      .expect(404);
    await env
      .post(
        `period-change-proposals/${proposal.id}/accept`,
        { reason: 'x' },
        unitUser,
      )
      .expect(404);
    await env
      .get(`period-change-proposals/${proposal.id}`, env.adminB)
      .expect(404);
    for (const path of [
      `production-periods/${env.periodA1}/reconciliation`,
      `production-periods/${env.periodA1}/change-proposals`,
      `production-periods/${env.periodA1}/approval-actions`,
    ]) {
      await env.get(path, env.adminB).expect(404);
    }
    const fresh = await env.view(env.periodA1);
    await env.saveLines(fresh, [], env.adminB).expect(404);
    await env
      .post(
        `production-periods/${env.periodA1}/approve`,
        {
          revision: 1,
          submittedHash: 'a'.repeat(64),
        },
        env.adminB,
      )
      .expect(404);
    await env
      .get(`production-periods/${env.periodA1}/reconciliation?tenantId=x`)
      .expect(400);
  });
});
