import { randomUUID } from 'crypto';
import { enqueueOutbox } from '../../src/common/outbox/outbox-writer';
import { PLAN_VERSION_APPROVED } from '../../src/plans/plan-events';
import { A, HOUR } from './support/actuals-world';
import { plus } from './support/accounting-world';
import { ApiError, DAY1, DAY2 } from './support/plan-world';
import {
  ReconciliationBody,
  ReconciliationWorld,
} from './support/reconciliation-world';

interface ProposalBody {
  id: string;
  trigger: string;
  state: string;
  before: { slices: Array<{ residual: string }>; calculationRunId: string };
  after: { slices: Array<{ residual: string }> } | null;
  detail: Record<string, unknown>;
  createdRevisionId: string | null;
}

/**
 * Plan 2.8 step 5 on real Postgres — late corrections (WF04): a source change between submit and approve
 * marks the submission stale and approval answers 409; recompute + resubmit gives a new hash that approves
 * (T34). A change after approval never touches the approved revision or its snapshot: a change proposal
 * opens with before / after; accepting it opens a linked draft while the approved revision is still served
 * (T35), and the draft reuses the actuals result (T44). A baseline plan restatement proposes a change for
 * reconciled periods (deferred by 2.3 / 2.4); a proposal can be dismissed with a reason.
 */
describe('late corrections and change proposals (plan 2.8)', () => {
  const env = new ReconciliationWorld();
  let reason = '';
  let firstHash = '';

  const manual = (view: ReconciliationBody, quantity: string) => ({
    action: 'manual',
    sliceId: view.slices[0].sliceId,
    kind: 'availability',
    quantity,
    missingEvent: true,
    reasonCodeId: reason,
  });

  /** Rejects every candidate, explains the gap with one manual line and submits. */
  const submitBalanced = async (
    periodId: string,
  ): Promise<ReconciliationBody> => {
    const view = await env.view(periodId);
    const lines = [
      ...view.candidates.map((c) => ({
        action: 'reject',
        autoKey: c.autoKey,
        reason: 'not the cause',
      })),
      manual(view, view.slices[0].gap as string),
    ];
    await env.saveLines(view, lines, env.admin, periodId).expect(200);
    await env.submit(await env.view(periodId), env.admin, periodId).expect(200);
    return env.view(periodId);
  };

  const proposals = async (periodId: string) =>
    (
      (
        await env
          .get(`production-periods/${periodId}/change-proposals`)
          .expect(200)
      ).body as { items: ProposalBody[] }
    ).items;

  beforeAll(async () => {
    await env.start();
    reason = await env.reasonCode('FEED');
  });
  afterAll(() => env.stop());

  it('T34: a source revision between submit and approve makes the submission stale (409)', async () => {
    const submitted = await submitBalanced(env.periodA1);
    firstHash = submitted.revision.submittedHash as string;
    await env.lossEvent(env.world.unitA1, plus(A, HOUR), 1);
    await env.settle();
    const stale = await env.view();
    expect(stale.revision).toMatchObject({
      lifecycle: 'in_review',
      isStale: true,
    });
    expect(stale.revision.staleReason).toContain('loss_event_changed');
    expect(stale.baseRunId).toBe(submitted.baseRunId);
    const refused = await env.approve(stale).expect(409);
    expect((refused.body as ApiError).code).toBe('STALE_SUBMISSION');
  });

  it('T34: recompute + resubmit → approve succeeds with a new hash', async () => {
    await env.recompute(env.periodA1);
    const draft = await env.view();
    expect(draft.revision).toMatchObject({
      lifecycle: 'draft',
      isStale: false,
    });
    expect(draft.candidates).toHaveLength(1);
    expect(draft.slices[0].overAccounted).toBe('90');
    const resubmitted = await submitBalanced(env.periodA1);
    expect(resubmitted.revision.submittedHash).not.toBe(firstHash);
    const approved = (await env.approve(resubmitted).expect(200))
      .body as ReconciliationBody;
    expect(approved.revision.lifecycle).toBe('approved');
    const history = await env.rows<{ action: string; service: string | null }>(
      `SELECT action, service FROM approval_actions WHERE revision_id = $1 ORDER BY created_at`,
      [approved.revision.id],
    );
    expect(history.map((h) => h.action)).toEqual([
      'save_draft',
      'submit',
      'stale',
      'recompute',
      'save_draft',
      'submit',
      'approve',
    ]);
    expect(history[2].service).toBe('accounting-run');
  });

  it('T35: a late correction after approval opens a proposal; the approved revision and snapshot are untouched', async () => {
    const approved = await env.view(env.periodA1, env.admin, '?view=approved');
    const [snapshotBefore] = await env.rows<{ content_hash: string }>(
      `SELECT content_hash FROM approval_snapshots WHERE revision_id = $1`,
      [approved.revision.id],
    );
    await env.lossEvent(env.world.unitA1, plus(A, 5 * HOUR), 0.5);
    await env.settle();
    const after = await env.view(env.periodA1, env.admin, '?view=approved');
    expect(after.rowVersion).toBe(approved.rowVersion);
    expect(after.contentHash).toBe(approved.contentHash);
    const [snapshotAfter] = await env.rows<{ content_hash: string }>(
      `SELECT content_hash FROM approval_snapshots WHERE revision_id = $1`,
      [approved.revision.id],
    );
    expect(snapshotAfter).toEqual(snapshotBefore);
    const [proposal] = await proposals(env.periodA1);
    expect(proposal).toMatchObject({ trigger: 'event_change', state: 'open' });
    expect(proposal.before.slices[0].residual).toBe('0');
    expect(proposal.before.calculationRunId).toBe(approved.baseRunId);
    expect(proposal.after?.slices[0].residual).toBe('-45');
    expect(after.openProposalId).toBe(proposal.id);
  });

  it('T35: accepting the proposal opens a linked draft; the approved revision is still served (T44: actuals reused)', async () => {
    const [proposal] = await proposals(env.periodA1);
    const accepted = await env
      .post(
        `period-change-proposals/${proposal.id}/accept`,
        {
          reason: 'late stop correction',
        },
        env.approver,
      )
      .expect(200);
    const decision = accepted.body as {
      proposal: ProposalBody;
      revision: ReconciliationBody;
    };
    expect(decision.proposal.state).toBe('accepted');
    expect(decision.revision.revision).toMatchObject({
      revision: 2,
      lifecycle: 'draft',
    });
    const approved = await env.view(env.periodA1, env.admin, '?view=approved');
    expect(decision.revision.revision.supersedesId).toBe(approved.revision.id);
    expect(decision.proposal.createdRevisionId).toBe(
      decision.revision.revision.id,
    );
    await env.runActuals();
    const draft = await env.view();
    expect(draft.revision.revision).toBe(2);
    expect(draft.publishedRevision).toBe(1);
    expect(draft.baseRunId).not.toBeNull();
    expect(draft.lines.filter((l) => l.action === 'manual')).toHaveLength(1);
    const runs = await env.rows<{ id: string; actuals_run_id: string }>(
      `SELECT id, actuals_run_id FROM calculation_runs WHERE id = ANY($1::uuid[])`,
      [[approved.baseRunId, draft.baseRunId]],
    );
    expect(new Set(runs.map((r) => r.actuals_run_id)).size).toBe(1);
    const shown = await env.accounting(
      env.periodA1,
      env.admin,
      '?view=approved',
    );
    expect(shown.data.revision?.revision).toBe(1);
    expect(shown.isProvisional).toBe(false);
    const again = await env
      .post(
        `production-periods/${env.periodA1}/revise`,
        {
          approvedRevision: 1,
          reason: 'twice',
        },
        env.approver,
      )
      .expect(409);
    expect((again.body as ApiError).code).toBe('REVISION_OPEN');
  });

  it('a baseline plan restatement proposes a change for reconciled periods; a proposal can be dismissed', async () => {
    const submitted = await submitBalanced(env.periodB1);
    await env.approve(submitted, env.approver, env.periodB1).expect(200);
    await env.harness.dataSource.transaction((manager) =>
      enqueueOutbox(manager, [
        {
          tenantId: env.world.tenantA,
          aggregateType: 'plan_version',
          aggregateId: randomUUID(),
          type: PLAN_VERSION_APPROVED,
          payload: {
            isAccountingBaseline: true,
            unitId: env.world.unitA1,
            validFrom: DAY1,
            validTo: DAY2,
            restatementRequired: true,
          },
        },
      ]),
    );
    await env.relay();
    const [proposal] = await proposals(env.periodB1);
    expect(proposal).toMatchObject({
      trigger: 'plan_change',
      state: 'open',
      after: null,
    });
    expect(proposal.detail.planVersionId).toBeDefined();
    const dismissed = await env
      .post(
        `period-change-proposals/${proposal.id}/dismiss`,
        {
          reason: 'same targets',
        },
        env.approver,
      )
      .expect(200);
    expect((dismissed.body as { proposal: ProposalBody }).proposal.state).toBe(
      'dismissed',
    );
    await env
      .post(
        `period-change-proposals/${proposal.id}/accept`,
        { reason: 'x' },
        env.approver,
      )
      .expect(409);
    const audit = await env.rows<{ action: string }>(
      `SELECT action FROM audit_log WHERE entity_id = $1 ORDER BY at`,
      [proposal.id],
    );
    expect(audit.map((a) => a.action)).toEqual([
      'period_change_proposal.opened',
      'period_change_proposal.dismissed',
    ]);
  });
});
