import { randomUUID } from 'crypto';
import { A, HOUR } from './support/actuals-world';
import { plus } from './support/accounting-world';
import { ApiError } from './support/plan-world';
import {
  ReconciliationBody,
  ReconciliationWorld,
} from './support/reconciliation-world';
import { signToken } from './support/test-app';

interface MonthCloseBody {
  monthKey: string;
  calendar: string;
  firstDate: string;
  endDate: string;
  previousMonthKey: string;
  nextMonthKey: string;
  state: string;
  policy: { version: number; weekendDays: number[] };
  deadlines: {
    quantitiesDue: string;
    financeDue: string;
    quantitiesDueAt: string;
  };
  signOffs: {
    quantitiesClosedBy: { id: string } | null;
    financeSignedOffBy: { id: string } | null;
    materialityRequired: boolean;
    materialityReviewedBy: { id: string } | null;
    lockedBy: { id: string } | null;
  };
  prerequisites: {
    met: boolean;
    periods: number;
    approved: number;
    pendingCount: number;
    pending: Array<{ periodId: string; workflow: string }>;
    openProposalCount: number;
  };
  materiality: {
    findings: Array<{ uom: string; quantity: string }>;
    adjustmentTotals: Array<{ uom: string; quantity: string }>;
  };
  history: Array<{ action: string; fromState: string; toState: string }>;
}

/** Esfand 1405 (20 Feb – 20 Mar 2027) holds the world's 1 Mar 2027 periods; the tenant is Asia/Tehran. */
const MONTH = '1405-12';

/**
 * SME R1 / R4 (phase R-B) on real Postgres: a Solar Hijri month close with working-day deadlines (Thursday–
 * Friday weekend), prerequisites (every period approved), the quantity close by plant management, finance
 * sign-off by someone else (403 SEPARATION_OF_DUTIES for one person holding both roles), materiality
 * routing, lock, and corrections: a closing month refuses a revise (MONTH_CLOSING), a locked one only takes
 * a change proposal (MONTH_LOCKED for a direct revise) and marks the correction `afterClose`.
 */
describe('month close (SME R1 / R4)', () => {
  const env = new ReconciliationWorld();
  let reason = '';

  const month = async (token = env.admin) =>
    (await env.get(`month-closes/${MONTH}`, token).expect(200))
      .body as MonthCloseBody;
  const step = (action: string, token: string, body: object = {}) =>
    env.post(`month-closes/${MONTH}/${action}`, body, token);

  /** Explains the period's gap with one manual line, submits (admin) and approves (approver). */
  const approvePeriod = async (periodId: string, quantity?: string) => {
    const view = await env.view(periodId);
    const lines = env.rejectAllPlus(
      view,
      quantity ?? (view.slices[0].gap as string),
      reason,
    );
    await env.saveLines(view, lines, env.admin, periodId).expect(200);
    await env.submit(await env.view(periodId), env.admin, periodId).expect(200);
    const submitted = await env.view(periodId);
    await env.approve(submitted, env.approver, periodId).expect(200);
  };

  /** A user of tenant A holding both plant management and finance approval on the whole tenant. */
  const dualRoleUser = async (): Promise<string> => {
    const userId = randomUUID();
    await env.rows(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id) VALUES ($1, 'dual', $2, 'x', 'Operator', $3)`,
      [userId, `${userId}@test.local`, env.world.tenantA],
    );
    for (const role of ['manager_approver', 'finance_approver']) {
      await env.rows(
        `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version)
         VALUES ($1, $2, 'tenant', $1, $3, 1)`,
        [env.world.tenantA, userId, role],
      );
    }
    return signToken(env.app, {
      userId,
      tenantId: env.world.tenantA,
      role: 'Operator',
    });
  };

  beforeAll(async () => {
    await env.start();
    reason = await env.reasonCode('FEED');
  });
  afterAll(() => env.stop());

  it('reads an untouched Solar Hijri month: open, working-day deadlines, prerequisites unmet; no row written', async () => {
    const body = await month();
    expect(body).toMatchObject({
      monthKey: MONTH,
      calendar: 'persian',
      firstDate: '2027-02-20',
      endDate: '2027-03-21',
      previousMonthKey: '1405-11',
      nextMonthKey: '1406-01',
      state: 'open',
      policy: { version: 1, weekendDays: [4, 5] },
      // month end Sun 21 Mar: working days Sun, Mon, Tue (3) · Wed, (Thu/Fri off), Sat (5)
      deadlines: { quantitiesDue: '2027-03-23', financeDue: '2027-03-27' },
      prerequisites: { met: false, periods: 3, approved: 0, pendingCount: 3 },
    });
    // the end of the due day in Tehran (UTC+03:30)
    expect(body.deadlines.quantitiesDueAt).toBe('2027-03-23T20:30:00.000Z');
    const rows = await env.rows(`SELECT 1 FROM month_closes`);
    expect(rows).toHaveLength(0);
    await env.get('month-closes/current').expect(200);
    const bad = await env.get('month-closes/1405-13').expect(422);
    expect((bad.body as ApiError).code).toBeDefined();
  });

  it('refuses the quantity close while periods are not approved (422 CLOSE_PREREQUISITES)', async () => {
    const refused = await step('close-quantities', env.approver).expect(422);
    expect((refused.body as ApiError).code).toBe('CLOSE_PREREQUISITES');
    expect(
      (refused.body as { details: { pendingCount: number } }).details
        .pendingCount,
    ).toBe(3);
  });

  it('materiality routing: an adjustment at the policy threshold needs the extra review', async () => {
    await env.rows(
      `INSERT INTO accounting_policies (tenant_id, row_version, policy_kind, unit_id, scope_key, version, body,
              effective_from, approved_at)
       SELECT tenant_id, 1, 'month_close', NULL, 'tenant', 2,
              body || '{"materiality": {"enabled": true, "thresholds": {"t": 0.5}, "reviewerRoles": ["production_accountant"]}}'::jsonb,
              '1970-01-01T00:00:00Z', now()
         FROM accounting_policies WHERE tenant_id = $1 AND policy_kind = 'month_close' AND version = 1`,
      [env.world.tenantA],
    );
    await env.tolerancePolicy(env.world.unitA1, {
      mode: 'absolute',
      value: 1,
      epsilon: 0.000001,
      allowUnaccountedClassification: false,
    });
    await env.recompute(env.periodA1);
    await approvePeriod(env.periodA1, '149.5');
    await approvePeriod(env.periodB1);
    await approvePeriod(env.periodC1);
    const body = await month();
    expect(body.policy.version).toBe(2);
    expect(body.prerequisites).toMatchObject({ met: true, approved: 3 });
    expect(body.materiality.findings).toEqual([
      { uom: 't', quantity: '0.5', threshold: '0.5' },
    ]);
  });

  it('a unit-limited manager cannot close the plant month (403 TENANT_SCOPE_REQUIRED)', async () => {
    const unitManager = await env.unitUser(env.world.unitA1);
    const refused = await step('close-quantities', unitManager).expect(403);
    expect((refused.body as ApiError).code).toBe('TENANT_SCOPE_REQUIRED');
  });

  it('plant management closes quantities; a closing month refuses a revise (409 MONTH_CLOSING)', async () => {
    const closed = (
      await step('close-quantities', env.approver, { comment: 'Demo' }).expect(
        200,
      )
    ).body as MonthCloseBody;
    expect(closed.state).toBe('quantities_closed');
    expect(closed.signOffs.materialityRequired).toBe(true);
    const view = await env.view(env.periodB1);
    const revise = await env
      .post(
        `production-periods/${env.periodB1}/revise`,
        { approvedRevision: view.revision.revision, reason: 'fix' },
        env.approver,
      )
      .expect(409);
    expect((revise.body as ApiError).code).toBe('MONTH_CLOSING');
  });

  it('finance cannot sign before the materiality review; the reviewer is independent of the quantity signer', async () => {
    const early = await step('finance-sign-off', env.financeApprover).expect(
      409,
    );
    expect((early.body as ApiError).code).toBe('MATERIALITY_REVIEW_REQUIRED');
    const notReviewer = await step(
      'materiality-review',
      env.financeApprover,
    ).expect(403);
    expect((notReviewer.body as ApiError).code).toBe('MATERIALITY_REVIEWER');
    const accountant = await env.scopedUser('production_accountant');
    const reviewed = (await step('materiality-review', accountant).expect(200))
      .body as MonthCloseBody;
    expect(reviewed.signOffs.materialityReviewedBy).not.toBeNull();
  });

  it('one person holding both roles never signs both (403 SEPARATION_OF_DUTIES)', async () => {
    await step('reopen', env.approver, { reason: 'Demo: recheck' }).expect(200);
    const dual = await dualRoleUser();
    await step('close-quantities', dual).expect(200);
    const accountant = await env.scopedUser('production_accountant');
    await step('materiality-review', accountant).expect(200);
    const refused = await step('finance-sign-off', dual).expect(403);
    expect((refused.body as ApiError).code).toBe('SEPARATION_OF_DUTIES');
    const signed = (
      await step('finance-sign-off', env.financeApprover).expect(200)
    ).body as MonthCloseBody;
    expect(signed.state).toBe('finance_signed_off');
    const plantManagerOnly = await step('lock', env.approver).expect(403);
    expect((plantManagerOnly.body as ApiError).code).toBeDefined();
  });

  it('lock: never reopened; a direct revise is refused, a change proposal corrects after close', async () => {
    const locked = (await step('lock', env.financeApprover).expect(200))
      .body as MonthCloseBody;
    expect(locked.state).toBe('locked');
    expect(locked.history.map((h) => h.action)).toEqual([
      'lock',
      'sign_off_finance',
      'review_materiality',
      'close_quantities',
      'reopen',
      'review_materiality',
      'close_quantities',
    ]);
    const reopen = await step('reopen', env.approver, { reason: 'x' }).expect(
      409,
    );
    expect((reopen.body as ApiError).code).toBe('INVALID_TRANSITION');
    const view = await env.view(env.periodB1);
    const direct = await env
      .post(
        `production-periods/${env.periodB1}/revise`,
        { approvedRevision: view.revision.revision, reason: 'fix' },
        env.approver,
      )
      .expect(409);
    expect((direct.body as ApiError).code).toBe('MONTH_LOCKED');
    await env.lossEvent(env.world.unitA1, plus(A, 8 * HOUR + HOUR), 1);
    await env.settle();
    const proposals = (
      await env.get(`production-periods/${env.periodB1}/change-proposals`)
    ).body as { items: Array<{ id: string; state: string }> };
    const open = proposals.items.find((p) => p.state === 'open');
    expect(open).toBeDefined();
    const accepted = (
      await env
        .post(
          `period-change-proposals/${open?.id}/accept`,
          { reason: 'late stop after close' },
          env.approver,
        )
        .expect(200)
    ).body as {
      revision: ReconciliationBody & { revision: { afterClose: boolean } };
    };
    expect(accepted.revision.revision).toMatchObject({
      lifecycle: 'draft',
      afterClose: true,
    });
    const audit = await env.rows<{ action: string }>(
      `SELECT action FROM audit_log WHERE entity_type = 'month_close' ORDER BY at`,
    );
    expect(audit.map((a) => a.action)).toContain('month_close.lock');
  });
});
