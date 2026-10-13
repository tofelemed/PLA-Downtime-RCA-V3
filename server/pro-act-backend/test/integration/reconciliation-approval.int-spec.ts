import { A, HOUR } from './support/actuals-world';
import { plus } from './support/accounting-world';
import { ApiError } from './support/plan-world';
import {
  ReconciliationBody,
  ReconciliationWorld,
} from './support/reconciliation-world';

/**
 * Plan ledger at the planned rate (SME Q1): 1000 t per 8 h shift = 125 t/h, so a 1 h stop is a 125 t candidate.
 * Plan 2.8 steps 3–4 on real Postgres: submission gates (T15 residual 10 → RESIDUAL_UNEXPLAINED, T16
 * over-accounted 10 → OVER_ACCOUNTED), the tolerance adjustment (T32: target 1000, residual 0.5, policy
 * 0.1 % → explicit `tolerance_adjustment 0.5`, ledger closes), content hashes, separation of duties (T36:
 * the submitter is refused — also SuperAdmin and a user holding both roles — a different approver
 * succeeds), the approval snapshot and immutability, reject back to draft with the reason, cancel.
 */
describe('reconciliation submission and approval (plan 2.8)', () => {
  const env = new ReconciliationWorld();
  let reason = '';

  const manual = (view: ReconciliationBody, quantity: string) => ({
    action: 'manual',
    sliceId: view.slices[0].sliceId,
    kind: 'availability',
    quantity,
    missingEvent: true,
    reasonCodeId: reason,
  });

  /** Saves `lines` on the period's draft and returns the fresh view. */
  const saved = async (
    periodId: string,
    build: (view: ReconciliationBody) => Array<Record<string, unknown>>,
    token = env.admin,
  ): Promise<ReconciliationBody> => {
    const view = await env.view(periodId, token);
    await env.saveLines(view, build(view), token, periodId).expect(200);
    return env.view(periodId, token);
  };

  beforeAll(async () => {
    await env.start();
    reason = await env.reasonCode('FEED');
  });
  afterAll(() => env.stop());

  it('T15: residual 10 at zero tolerance → 422 RESIDUAL_UNEXPLAINED; nothing changes', async () => {
    await env.lossEvent(env.world.unitA1, plus(A, HOUR), 1);
    await env.settle();
    const view = await saved(env.periodA1, (v) => [
      { action: 'accept', autoKey: v.candidates[0].autoKey },
      manual(v, '10'),
      manual(v, '5'),
    ]);
    expect(view.slices[0]).toMatchObject({
      gap: '150',
      attributed: '140',
      residual: '10',
    });
    const response = await env.submit(view).expect(422);
    expect((response.body as ApiError).code).toBe('RESIDUAL_UNEXPLAINED');
    expect((await env.view()).revision.lifecycle).toBe('draft');
  });

  it('T16: over-accounted 10 → 422 OVER_ACCOUNTED', async () => {
    await env.lossEvent(env.world.unitA1, plus(A, 5 * HOUR), 1.28);
    await env.settle();
    const view = await saved(env.periodA1, (v) =>
      v.candidates.map((c) =>
        c.quantity === '160'
          ? { action: 'accept', autoKey: c.autoKey }
          : { action: 'reject', autoKey: c.autoKey, reason: 'other cause' },
      ),
    );
    expect(view.slices[0]).toMatchObject({
      attributed: '160',
      residual: '-10',
      overAccounted: '10',
    });
    const response = await env.submit(view).expect(422);
    expect((response.body as ApiError).code).toBe('OVER_ACCOUNTED');
  });

  it('a stale view cannot be submitted (409 CONTENT_CHANGED / RUN_CHANGED)', async () => {
    const view = await env.view();
    const content = await env
      .submit({ ...view, contentHash: '0'.repeat(64) })
      .expect(409);
    expect((content.body as ApiError).code).toBe('CONTENT_CHANGED');
    const run = await env
      .submit({ ...view, baseRunId: view.revision.id })
      .expect(409);
    expect((run.body as ApiError).code).toBe('RUN_CHANGED');
  });

  it('T32: residual 0.5 within 0.1 % → explicit tolerance adjustment 0.5 on submit; ledger closes', async () => {
    await env.tolerancePolicy(env.world.unitA1, {
      mode: 'percent',
      value: 0.1,
      epsilon: 0.000001,
      allowUnaccountedClassification: false,
    });
    await env.recompute(env.periodA1);
    const view = await saved(env.periodA1, (v) => [
      ...v.candidates.map((c) =>
        c.quantity === '125'
          ? { action: 'accept', autoKey: c.autoKey }
          : { action: 'reject', autoKey: c.autoKey, reason: 'other cause' },
      ),
      manual(v, '24.5'),
    ]);
    expect(view.slices[0]).toMatchObject({
      target: '1000',
      residual: '0.5',
      tolerance: '1',
      toleranceAdjustment: '0',
    });
    const response = await env.submit(view).expect(200);
    const submitted = response.body as ReconciliationBody;
    expect(submitted.revision.lifecycle).toBe('in_review');
    expect(submitted.slices[0]).toMatchObject({
      unadjustedResidual: '0.5',
      toleranceAdjustment: '0.5',
      residual: '0',
    });
    expect(submitted.lines).toContainEqual(
      expect.objectContaining({
        action: 'tolerance',
        kind: 'tolerance_adjustment',
        quantity: '0.5',
        authorId: null,
      }),
    );
    expect(submitted.revision.submittedHash).toBe(submitted.contentHash);
    expect(response.headers.etag).toBe(`"${submitted.rowVersion}"`);
  });

  it('T36: the submitter cannot approve (403); a different manager approver can (200)', async () => {
    const view = await env.view();
    const self = await env.approve(view, env.admin).expect(403);
    expect((self.body as ApiError).code).toBe('SEPARATION_OF_DUTIES');
    const selfReject = await env
      .post(`production-periods/${env.periodA1}/reject`, {
        revision: 1,
        reason: 'mine',
      })
      .expect(403);
    expect((selfReject.body as ApiError).code).toBe('SEPARATION_OF_DUTIES');
    await env.approve(view, env.analyst).expect(403);
    const wrongHash = await env
      .approve({
        ...view,
        revision: { ...view.revision, submittedHash: 'f'.repeat(64) },
      })
      .expect(409);
    expect((wrongHash.body as ApiError).code).toBe('STALE_SUBMISSION');
    const approved = (await env.approve(view).expect(200))
      .body as ReconciliationBody;
    expect(approved.revision.lifecycle).toBe('approved');
    expect(approved.publishedRevision).toBe(1);
    const [snapshot] = await env.rows<{
      submitted_hash: string;
      content: { reviewed: { lines: unknown[] }; approvedBy: string };
    }>(
      `SELECT submitted_hash, content FROM approval_snapshots WHERE revision_id = $1`,
      [view.revision.id],
    );
    expect(snapshot.submitted_hash).toBe(view.revision.submittedHash);
    expect(snapshot.content.reviewed.lines).toHaveLength(view.lines.length);
    const [period] = await env.rows<{ state_readiness: string }>(
      `SELECT state_readiness FROM production_periods WHERE id = $1`,
      [env.periodA1],
    );
    expect(period.state_readiness).toBe('reconciled');
    const outbox = await env.rows<{ type: string }>(
      `SELECT type FROM outbox WHERE aggregate_id = $1 AND type IN ('PeriodSubmitted', 'PeriodApproved')`,
      [env.periodA1],
    );
    expect(outbox.map((m) => m.type).sort()).toEqual([
      'PeriodApproved',
      'PeriodSubmitted',
    ]);
  });

  it('approved revisions are immutable at the database level', async () => {
    const view = await env.view();
    await expect(
      env.rows(`UPDATE accounting_revisions SET comment = 'x' WHERE id = $1`, [
        view.revision.id,
      ]),
    ).rejects.toThrow(/immutable/);
    await expect(
      env.rows(`DELETE FROM accounting_revisions WHERE id = $1`, [
        view.revision.id,
      ]),
    ).rejects.toThrow(/immutable/);
    await expect(
      env.rows(
        `UPDATE approval_snapshots SET content_hash = 'x' WHERE revision_id = $1`,
        [view.revision.id],
      ),
    ).rejects.toThrow(/append-only/);
  });

  it('T36: a SuperAdmin submitter is refused too; reject returns to draft with the reason', async () => {
    const superAdmin = env.user('SuperAdmin');
    const view = await saved(
      env.periodB1,
      (v) => [manual(v, '150')],
      superAdmin,
    );
    await env.submit(view, superAdmin, env.periodB1).expect(200);
    const submitted = await env.view(env.periodB1);
    const self = await env
      .approve(submitted, superAdmin, env.periodB1)
      .expect(403);
    expect((self.body as ApiError).code).toBe('SEPARATION_OF_DUTIES');
    const rejected = await env
      .post(
        `production-periods/${env.periodB1}/reject`,
        {
          revision: 1,
          reason: 'code the feed outage',
        },
        env.approver,
      )
      .expect(200);
    expect((rejected.body as ReconciliationBody).revision).toMatchObject({
      lifecycle: 'draft',
      rejectReason: 'code the feed outage',
      submittedHash: null,
    });
    const actions = await env
      .get(`production-periods/${env.periodB1}/approval-actions`)
      .expect(200);
    expect(
      (
        actions.body as {
          items: Array<{ action: string; reason: string | null }>;
        }
      ).items.map((a) => a.action),
    ).toEqual(['reject', 'submit', 'save_draft']);
  });

  it('RC-01: an author of a reviewed line cannot approve; an independent approver can', async () => {
    const superAdmin = env.user('SuperAdmin');
    const view = await saved(
      env.periodB1,
      (v) => [manual(v, '150')],
      env.approver,
    );
    await env.submit(view, superAdmin, env.periodB1).expect(200);
    const submitted = await env.view(env.periodB1);
    const author = await env
      .approve(submitted, env.approver, env.periodB1)
      .expect(403);
    expect((author.body as ApiError).code).toBe('SEPARATION_OF_DUTIES');
    const independent = env.user('TenantAdmin');
    await env.approve(submitted, independent, env.periodB1).expect(200);
  });

  it('T36: a user holding both roles cannot approve their own submission; cancel keeps the draft auditable', async () => {
    const dual = await env.dualRoleUser();
    const view = await saved(env.periodC1, (v) => [manual(v, '150')], dual);
    await env.submit(view, dual, env.periodC1).expect(200);
    const submitted = await env.view(env.periodC1, dual);
    const self = await env.approve(submitted, dual, env.periodC1).expect(403);
    expect((self.body as ApiError).code).toBe('SEPARATION_OF_DUTIES');
    await env
      .post(`production-periods/${env.periodC1}/cancel`, {
        revision: 1,
        reason: 'wrong period',
      })
      .expect(409);
    await env
      .post(
        `production-periods/${env.periodC1}/reject`,
        {
          revision: 1,
          reason: 'recheck',
        },
        env.approver,
      )
      .expect(200);
    const cancelled = await env
      .post(`production-periods/${env.periodC1}/cancel`, {
        revision: 1,
        reason: 'wrong period',
      })
      .expect(200);
    expect((cancelled.body as ReconciliationBody).revision.lifecycle).toBe(
      'cancelled',
    );
    const audit = await env.rows<{ action: string }>(
      `SELECT action FROM audit_log WHERE entity_id = $1 ORDER BY at`,
      [view.revision.id],
    );
    expect(audit.map((a) => a.action)).toEqual([
      'accounting_revision.save_draft',
      'accounting_revision.submit',
      'accounting_revision.reject',
      'accounting_revision.cancel',
    ]);
  });
});
