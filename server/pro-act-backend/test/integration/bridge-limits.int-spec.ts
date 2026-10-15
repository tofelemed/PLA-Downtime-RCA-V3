import { randomUUID } from 'crypto';
import { RECONCILIATION_TOLERANCE_DEFAULT } from '../../src/periods/engine-policy-bodies';
import { ApiError } from './support/plan-world';
import {
  ReconciliationBody,
  ReconciliationWorld,
} from './support/reconciliation-world';
import { signToken } from './support/test-app';

interface BridgeReviewBody {
  required: boolean;
  findings: Array<{ quantity: string; limit: string; basis: string }>;
  review: { by: string | null } | null;
}

/**
 * SME R8 per-unit bridge limits on real Postgres: unit A1 allows bridges up to 10 t. A 20 t bridge needs a
 * second independent review before approval (`second_review`), by someone who neither submitted nor
 * approves it; with `refuse` the save itself is refused.
 */
describe('bridge limits (SME R8)', () => {
  const env = new ReconciliationWorld();
  let reason = '';

  const person = async (role: string) => {
    const id = randomUUID();
    await env.rows(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id) VALUES ($1, $2, $3, 'x', 'Operator', $4)`,
      [id, role, `${id}@test.local`, env.world.tenantA],
    );
    await env.rows(
      `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version) VALUES ($1, $2, 'tenant', $1, $3, 1)`,
      [env.world.tenantA, id, role],
    );
    return signToken(env.app, {
      userId: id,
      tenantId: env.world.tenantA,
      role: 'Operator',
    });
  };
  const policy = (overLimit: 'second_review' | 'refuse') =>
    env.tolerancePolicy(env.world.unitA1, {
      ...RECONCILIATION_TOLERANCE_DEFAULT,
      bridgeLimits: { absolute: 10, relative: null, overLimit },
    });
  const linesWithBridge = (view: ReconciliationBody, bridge: string) => {
    const gap = Number(view.slices[0].gap);
    return [
      ...env.rejectAllPlus(view, String(gap - Number(bridge)), reason),
      {
        action: 'manual',
        sliceId: view.slices[0].sliceId,
        kind: 'bridge',
        quantity: bridge,
        missingEvent: true,
        reasonCodeId: reason,
        classification: 'inventory',
        evidenceType: 'movement_record',
        evidenceRef: 'silo stock movement 4711',
        reason: 'verified in-process inventory increase',
      },
    ];
  };
  const bridgeReview = async (periodId: string) =>
    (await env.view(periodId)).bridgeReview as BridgeReviewBody;

  beforeAll(async () => {
    await env.start();
    reason = await env.reasonCode('FEED');
    await policy('second_review');
    await env.recompute(env.periodA1);
  });
  afterAll(() => env.stop());

  it('second_review: a bridge above the limit waits for an independent second reviewer before approval', async () => {
    const accountant = await person('production_accountant');
    const reviewer = await person('manager_approver');
    const view = await env.view(env.periodA1, accountant);
    await env
      .saveLines(view, linesWithBridge(view, '20'), accountant)
      .expect(200);
    await env
      .submit(await env.view(env.periodA1, accountant), accountant)
      .expect(200);
    const submitted = await env.view(env.periodA1);
    expect(await bridgeReview(env.periodA1)).toMatchObject({
      required: true,
      findings: [{ quantity: '20', limit: '10', basis: 'absolute' }],
      review: null,
    });
    const waiting = await env.approve(submitted).expect(409);
    expect((waiting.body as ApiError).code).toBe('BRIDGE_REVIEW_REQUIRED');
    const body = {
      revision: submitted.revision.revision,
      submittedHash: submitted.revision.submittedHash,
    };
    const own = await env
      .post(
        `production-periods/${env.periodA1}/bridge-review`,
        body,
        accountant,
      )
      .expect(403);
    expect((own.body as ApiError).code).toBe('SEPARATION_OF_DUTIES');
    await env
      .post(`production-periods/${env.periodA1}/bridge-review`, body, reviewer)
      .expect(200);
    expect((await bridgeReview(env.periodA1)).review?.by).toBeTruthy();
    const again = await env
      .post(
        `production-periods/${env.periodA1}/bridge-review`,
        body,
        env.approver,
      )
      .expect(409);
    expect((again.body as ApiError).code).toBe('BRIDGE_ALREADY_REVIEWED');
    const sameReviewer = await env.approve(submitted, reviewer).expect(403);
    expect((sameReviewer.body as ApiError).code).toBe('SEPARATION_OF_DUTIES');
    await env.approve(submitted).expect(200);
  });

  it('refuse: a bridge above the limit is refused at save; one within it is kept', async () => {
    await policy('refuse');
    await env.recompute(env.periodB1);
    const accountant = await person('production_accountant');
    const view = await env.view(env.periodB1, accountant);
    const refused = await env
      .saveLines(view, linesWithBridge(view, '20'), accountant, env.periodB1)
      .expect(422);
    expect((refused.body as ApiError).code).toBe('BRIDGE_OVER_LIMIT');
    await env
      .saveLines(view, linesWithBridge(view, '5'), accountant, env.periodB1)
      .expect(200);
    expect((await bridgeReview(env.periodB1)).findings).toEqual([]);
  });
});
