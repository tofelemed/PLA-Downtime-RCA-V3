import { A, HOUR } from './support/actuals-world';
import { plus } from './support/accounting-world';
import { ApiError } from './support/plan-world';
import {
  ReconciliationBody,
  ReconciliationWorld,
} from './support/reconciliation-world';

interface ProposalBody {
  id: string;
  trigger: string;
  state: string;
  before: { revision: number };
  after: Record<string, unknown> | null;
  manual: {
    proposedBy: string;
    reason: string;
    evidenceType: string;
    evidenceRef: string;
  } | null;
  resolvedBy: string | null;
  createdRevisionId: string | null;
}

/** Esfand 1405 (20 Feb – 20 Mar 2027) holds the world's 1 Mar 2027 periods; the tenant is Asia/Tehran. */
const MONTH = '1405-12';

/**
 * SME R4 leftover on real Postgres: a user proposes a correction of an approved period of a closing or locked
 * month (manual change proposal) with a reason and evidence; it follows the change-proposal decision path —
 * the proposer never decides it (403 SEPARATION_OF_DUTIES), a closing month refuses the acceptance
 * (MONTH_CLOSING), a locked month's accepted correction is a revise draft marked `afterClose`; an open month
 * refuses the proposal (MONTH_OPEN: revise directly).
 */
describe('manual change proposal of a closed month (SME R4)', () => {
  const env = new ReconciliationWorld();
  let reason = '';
  let accountant = '';
  let engineer = '';

  const propose = (periodId: string, revision: number, token: string) =>
    env.post(
      'period-change-proposals',
      {
        periodId,
        approvedRevision: revision,
        reason: 'Demo: totalizer reading corrected by the lab',
        evidenceType: 'totalizer',
        evidenceRef: 'FT-101 2027-03-01 06:00',
      },
      token,
    );
  const decide = (id: string, decision: string, token: string) =>
    env.post(
      `period-change-proposals/${id}/${decision}`,
      { reason: 'Demo: checked against the totalizer' },
      token,
    );
  const setMonthState = (state: string) =>
    env.rows(`UPDATE month_closes SET state = $1 WHERE month_key = $2`, [
      state,
      MONTH,
    ]);

  const approvePeriod = async (periodId: string) => {
    const view = await env.view(periodId);
    const lines = env.rejectAllPlus(view, view.slices[0].gap as string, reason);
    await env.saveLines(view, lines, env.admin, periodId).expect(200);
    await env.submit(await env.view(periodId), env.admin, periodId).expect(200);
    await env
      .approve(await env.view(periodId), env.approver, periodId)
      .expect(200);
  };

  beforeAll(async () => {
    await env.start();
    reason = await env.reasonCode('FEED');
    accountant = await env.scopedUser('production_accountant');
    engineer = await env.scopedUser('production_engineer');
    await approvePeriod(env.periodA1);
    await approvePeriod(env.periodB1);
    // the month row as the first close command writes it (seeds the month_close policy on read)
    await env.get(`month-closes/${MONTH}`).expect(200);
    await env.rows(
      `INSERT INTO month_closes (tenant_id, row_version, calendar, month_key, first_date, end_date, state,
              policy_id, policy_version)
       SELECT tenant_id, 1, 'persian', $2, '2027-02-20', '2027-03-21', 'open', id, version
         FROM accounting_policies WHERE tenant_id = $1 AND policy_kind = 'month_close' AND version = 1`,
      [env.world.tenantA, MONTH],
    );
  });
  afterAll(() => env.stop());

  it('an open month refuses a manual proposal (409 MONTH_OPEN: revise directly)', async () => {
    const view = await env.view(env.periodB1);
    const refused = await propose(
      env.periodB1,
      view.revision.revision,
      accountant,
    ).expect(409);
    expect((refused.body as ApiError).code).toBe('MONTH_OPEN');
  });

  it('only production accounting and plant management propose; reason and evidence are required', async () => {
    await setMonthState('quantities_closed');
    const view = await env.view(env.periodB1);
    const forbidden = await propose(
      env.periodB1,
      view.revision.revision,
      engineer,
    ).expect(403);
    expect((forbidden.body as ApiError).code).toBeDefined();
    await env
      .post(
        'period-change-proposals',
        {
          periodId: env.periodB1,
          approvedRevision: view.revision.revision,
          reason: 'x',
        },
        accountant,
      )
      .expect(422);
    const mismatch = await propose(
      env.periodB1,
      view.revision.revision + 1,
      accountant,
    ).expect(409);
    expect((mismatch.body as ApiError).code).toBe('REVISION_MISMATCH');
  });

  it('a closing month: proposed with reason and evidence, one open per revision, the proposer never decides, acceptance waits for the reopen or the lock', async () => {
    const view = await env.view(env.periodB1);
    const created = (
      await propose(env.periodB1, view.revision.revision, accountant).expect(
        201,
      )
    ).body as ProposalBody;
    expect(created).toMatchObject({
      trigger: 'manual_correction',
      state: 'open',
      before: { revision: view.revision.revision },
      after: null,
      manual: {
        reason: 'Demo: totalizer reading corrected by the lab',
        evidenceType: 'totalizer',
        evidenceRef: 'FT-101 2027-03-01 06:00',
      },
    });
    const again = await propose(
      env.periodB1,
      view.revision.revision,
      env.approver,
    ).expect(409);
    expect((again.body as ApiError).code).toBe('PROPOSAL_OPEN');
    const own = await decide(created.id, 'accept', accountant).expect(403);
    expect((own.body as ApiError).code).toBe('SEPARATION_OF_DUTIES');
    const ownDismiss = await decide(created.id, 'dismiss', accountant).expect(
      403,
    );
    expect((ownDismiss.body as ApiError).code).toBe('SEPARATION_OF_DUTIES');
    const closing = await decide(created.id, 'accept', env.approver).expect(
      409,
    );
    expect((closing.body as ApiError).code).toBe('MONTH_CLOSING');
    const month = (await env.get(`month-closes/${MONTH}`).expect(200)).body as {
      prerequisites: {
        openProposals: Array<{
          proposalId: string;
          trigger: string;
          manualReason: string | null;
          planId: string | null;
        }>;
      };
    };
    expect(month.prerequisites.openProposals).toEqual([
      expect.objectContaining({
        proposalId: created.id,
        trigger: 'manual_correction',
        manualReason: 'Demo: totalizer reading corrected by the lab',
        planId: expect.any(String) as string,
      }),
    ]);
  });

  it('a locked month: an approver other than the proposer accepts — a revise draft marked afterClose', async () => {
    await setMonthState('locked');
    const listed = (
      await env.get(`production-periods/${env.periodB1}/change-proposals`)
    ).body as { items: ProposalBody[] };
    const open = listed.items.find((p) => p.state === 'open');
    const accepted = (
      await decide(open?.id ?? '', 'accept', env.approver).expect(200)
    ).body as {
      proposal: ProposalBody;
      revision: ReconciliationBody & {
        revision: { afterClose: boolean; lifecycle: string };
      };
    };
    expect(accepted.proposal.state).toBe('accepted');
    expect(accepted.proposal.resolvedBy).not.toBeNull();
    expect(accepted.proposal.createdRevisionId).not.toBeNull();
    expect(accepted.revision.revision).toMatchObject({
      lifecycle: 'draft',
      afterClose: true,
    });
    const audit = await env.rows<{ action: string }>(
      `SELECT action FROM audit_log WHERE entity_type = 'period_change_proposal' AND entity_id = $1 ORDER BY at`,
      [open?.id],
    );
    expect(audit.map((a) => a.action)).toEqual([
      'period_change_proposal.opened',
      'period_change_proposal.accepted',
    ]);
  });

  it('a later system change refreshes the preview but keeps the manual trigger, reason and evidence; another approver dismisses it', async () => {
    const view = await env.view(env.periodA1);
    const created = (
      await propose(env.periodA1, view.revision.revision, env.approver).expect(
        201,
      )
    ).body as ProposalBody;
    await env.lossEvent(env.world.unitA1, plus(A, HOUR), 1);
    await env.settle();
    const refreshed = (
      await env.get(`period-change-proposals/${created.id}`).expect(200)
    ).body as ProposalBody;
    expect(refreshed.id).toBe(created.id);
    expect(refreshed.trigger).toBe('manual_correction');
    expect(refreshed.manual?.evidenceType).toBe('totalizer');
    expect(refreshed.after).not.toBeNull();
    const dismissed = (
      await decide(created.id, 'dismiss', accountant).expect(200)
    ).body as { proposal: ProposalBody; revision: null };
    expect(dismissed.proposal.state).toBe('dismissed');
    expect(dismissed.revision).toBeNull();
  });
});
