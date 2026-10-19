import { randomUUID } from 'crypto';
import { B, HOUR } from './support/actuals-world';
import { plus } from './support/accounting-world';
import { ApiError } from './support/plan-world';
import { ReconciliationWorld } from './support/reconciliation-world';
import { signToken } from './support/test-app';

interface InboxItemBody {
  id: string;
  kind: string;
  canDecide: boolean;
  decisionBlockedReason: string | null;
}

/** The user id (`sub`) a test token was signed for. */
const userOf = (token: string): string =>
  (
    JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
    ) as { sub: string }
  ).sub;

/**
 * Owner decision 2026-10-19 on real Postgres: the finance approver who sets a restatement's posting date and
 * treatment is not the person who proposed the correction behind it (the manual change proposal whose
 * acceptance opened the revision) — 403 SEPARATION_OF_DUTIES, shown by the approval inbox as "cannot
 * decide" with the reason and left out of "only what I can decide". Another finance approver posts it;
 * SuperAdmin may post its own correction.
 */
describe('restatement posting independence from the correction proposer', () => {
  const env = new ReconciliationWorld();
  let proposer = '';
  let superAdmin = '';
  let revisionId = '';
  const path = () => `production-periods/${env.periodB1}/revisions/2/posting`;
  const post = (token: string) =>
    env.post(
      path(),
      { postingDate: '2027-04-02', treatment: 'correction' },
      token,
    );
  const markManual = (userId: string) =>
    env.rows(
      `UPDATE period_change_proposals
          SET detail = jsonb_build_object('manual', jsonb_build_object(
                'proposedBy', $2::text, 'reason', 'Demo: lab recount', 'evidenceType', 'lab', 'evidenceRef', 'LAB-7'))
        WHERE created_revision_id = $1`,
      [revisionId, userId],
    );
  const approveCurrent = async (reason: string, approver = env.approver) => {
    const view = await env.view(env.periodB1);
    await env
      .saveLines(
        view,
        env.rejectAllPlus(view, view.slices[0].gap as string, reason),
        env.admin,
        env.periodB1,
      )
      .expect(200);
    await env
      .submit(await env.view(env.periodB1), env.admin, env.periodB1)
      .expect(200);
    await env
      .approve(await env.view(env.periodB1), approver, env.periodB1)
      .expect(200);
  };

  beforeAll(async () => {
    await env.start();
    const reason = await env.reasonCode('FEED');
    proposer = await env.scopedUser('finance_approver');
    const adminId = randomUUID();
    await env.rows(
      "INSERT INTO users (id,name,email,password_hash,role,tenant_id) VALUES ($1,'Posting SuperAdmin',$2,'x','SuperAdmin',$3)",
      [adminId, `${adminId}@test.local`, env.world.tenantA],
    );
    superAdmin = signToken(env.app, {
      userId: adminId,
      tenantId: env.world.tenantA,
      role: 'SuperAdmin',
    });
    await approveCurrent(reason);
    await env.lossEvent(env.world.unitA1, plus(B, HOUR), 1);
    await env.settle();
    const proposals = (
      await env.get(`production-periods/${env.periodB1}/change-proposals`)
    ).body as { items: Array<{ id: string; state: string }> };
    const open = proposals.items.find((p) => p.state === 'open');
    await env
      .post(
        `period-change-proposals/${open?.id}/accept`,
        { reason: 'late stop' },
        env.approver,
      )
      .expect(200);
    await env.runActuals();
    // whoever accepted the proposal reopened the period: an independent manager approves revision 2
    await approveCurrent(reason, await env.scopedUser('manager_approver'));
    const [revision] = await env.rows<{ id: string }>(
      'SELECT id FROM accounting_revisions WHERE period_id = $1 AND revision = 2',
      [env.periodB1],
    );
    revisionId = revision.id;
    await markManual(userOf(proposer));
  });
  afterAll(() => env.stop());

  it('the inbox shows the proposer why they cannot decide and leaves it out of "only what I can decide"', async () => {
    const own = (
      await env
        .get(`approval-inbox/finance-posting/${revisionId}`, proposer)
        .expect(200)
    ).body as InboxItemBody;
    expect(own).toMatchObject({
      canDecide: false,
      decisionBlockedReason: expect.stringContaining(
        'a different finance approver',
      ) as string,
    });
    const decidable = (
      await env
        .get('approval-inbox?kind=finance-posting&decidable=true', proposer)
        .expect(200)
    ).body as { items: InboxItemBody[] };
    expect(decidable.items.map((item) => item.id)).not.toContain(revisionId);
    const other = (
      await env
        .get(
          `approval-inbox/finance-posting/${revisionId}`,
          env.financeApprover,
        )
        .expect(200)
    ).body as InboxItemBody;
    expect(other).toMatchObject({
      canDecide: true,
      decisionBlockedReason: null,
    });
  });

  it('refuses the proposer (403 SEPARATION_OF_DUTIES) and accepts another finance approver', async () => {
    const refused = await post(proposer).expect(403);
    expect(refused.body as ApiError).toMatchObject({
      code: 'SEPARATION_OF_DUTIES',
      message: expect.stringContaining('your change proposal') as string,
    });
    await post(env.financeApprover).expect(200);
  });

  it('SuperAdmin may post a restatement of its own correction', async () => {
    await markManual(userOf(superAdmin));
    await post(superAdmin).expect(200);
  });
});
