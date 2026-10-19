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
    days: number;
    certifiedDays: number;
    periods: number;
    approved: number;
    pendingCount: number;
    pending: Array<{ periodId: string; workflow: string }>;
    missingPeriodCount: number;
    uncoveredDayCount: number;
    uncoveredDays: Array<{ unitName: string | null; shifts: number }>;
    monthEnded: boolean;
    monthEndsAt: string;
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

  it('reads the month key in the plant close calendar: a Gregorian key is refused, a qualified key is accepted', async () => {
    // Marun E2E: 2026-10 was read as Persian year 2026 (Gregorian 2647)
    const gregorian = await env.get('month-closes/2026-10').expect(422);
    expect(gregorian.body).toMatchObject({
      code: 'MONTH_KEY_AMBIGUOUS',
      details: { calendar: 'persian', overlaps: ['1405-07', '1405-08'] },
    });
    const explicit = await env
      .get('month-closes/gregorian:2026-10')
      .expect(422);
    expect((explicit.body as ApiError).code).toBe('MONTH_CALENDAR_MISMATCH');
    const qualified = (
      await env.get(`month-closes/persian:${MONTH}`).expect(200)
    ).body as MonthCloseBody;
    expect(qualified).toMatchObject({
      monthKey: MONTH,
      firstDate: '2027-02-20',
    });
    const refused = await env
      .post('month-closes/2026-10/close-quantities', {}, env.approver)
      .expect(422);
    expect((refused.body as ApiError).code).toBe('MONTH_KEY_AMBIGUOUS');
    expect(await env.rows(`SELECT 1 FROM month_closes`)).toHaveLength(0);
  });

  it('refuses the quantity close of a month that has not ended (422 MONTH_NOT_ENDED), even with nothing pending', async () => {
    // Dey 1408 = 21 Dec 2029 – 19 Jan 2030 holds the test clock (1 Jan 2030); it has no shift or period
    const open = (await env.get('month-closes/1408-10').expect(200))
      .body as MonthCloseBody;
    expect(open.prerequisites).toMatchObject({
      met: false,
      periods: 0,
      missingPeriodCount: 0,
      monthEnded: false,
      monthEndsAt: '2030-01-19T20:30:00.000Z',
    });
    const refused = await env
      .post('month-closes/1408-10/close-quantities', {}, env.approver)
      .expect(422);
    expect(refused.body).toMatchObject({
      code: 'MONTH_NOT_ENDED',
      details: { monthEndsAt: '2030-01-19T20:30:00.000Z' },
    });
    expect(await env.rows(`SELECT 1 FROM month_close_actions`)).toHaveLength(0);
  });

  it('refuses the quantity close while periods are not approved (422 CLOSE_PREREQUISITES)', async () => {
    const refused = await step('close-quantities', env.approver).expect(422);
    expect((refused.body as ApiError).code).toBe('CLOSE_PREREQUISITES');
    expect(
      (refused.body as { details: { pendingCount: number } }).details
        .pendingCount,
    ).toBe(3);
  });

  it('a scheduled shift no approved plan covers is information; a planned shift without a production period blocks the close', async () => {
    // owner decision 2026-10-19: the world's plan covers 1 Mar 2027 only — the other scheduled days wait for a plan
    const unplanned = await month();
    expect(unplanned.prerequisites).toMatchObject({
      monthEnded: true,
      missingPeriodCount: 0,
      periods: 3,
    });
    expect(unplanned.prerequisites.uncoveredDayCount).toBeGreaterThan(0);
    expect(unplanned.prerequisites.uncoveredDays[0]).toMatchObject({
      unitName: expect.any(String) as string,
      shifts: expect.any(Number) as number,
    });
    // an approved plan version now covers one of those shifts: it is expected and blocks the close
    await env.rows(
      `INSERT INTO plan_periods (tenant_id, row_version, plan_version_id, slice_id, unit_id, shift_instance_id,
              calendar_version_id, utc_start, utc_end, local_date, shift_name, scheduled_seconds, target,
              quantity_uom, profile_id, is_excluded)
       SELECT pp.tenant_id, 1, pp.plan_version_id, pp.slice_id, pp.unit_id, si.id, pp.calendar_version_id,
              si.utc_start, si.utc_end, si.local_date, si.shift_name, pp.scheduled_seconds, pp.target,
              pp.quantity_uom, pp.profile_id, false
         FROM plan_periods pp
         JOIN shift_instances si ON si.tenant_id = pp.tenant_id AND si.unit_id = pp.unit_id
        WHERE pp.tenant_id = $1 AND NOT si.is_excluded AND si.local_date >= '2027-02-20' AND si.local_date < '2027-03-21'
          AND NOT EXISTS (SELECT 1 FROM production_periods p WHERE p.unit_id = si.unit_id
                AND tstzrange(p.utc_start, p.utc_end, '[)') && tstzrange(si.utc_start, si.utc_end, '[)'))
        ORDER BY si.utc_start LIMIT 1`,
      [env.world.tenantA],
    );
    const body = await month();
    expect(body.prerequisites.missingPeriodCount).toBe(1);
    const refused = await step('close-quantities', env.approver).expect(422);
    expect(refused.body).toMatchObject({
      code: 'CLOSE_PREREQUISITES',
      details: { missingPeriodCount: body.prerequisites.missingPeriodCount },
    });
    // fixture: the plant calendar no longer schedules the other days (only 1 Mar 2027 is accounted here)
    await env.rows(
      `DELETE FROM shift_instances si WHERE si.tenant_id = $1 AND NOT EXISTS (
         SELECT 1 FROM production_periods p WHERE p.unit_id = si.unit_id
            AND tstzrange(p.utc_start, p.utc_end, '[)') && tstzrange(si.utc_start, si.utc_end, '[)'))`,
      [env.world.tenantA],
    );
    // the planned copy of the deleted shift stays frozen in its plan version; nothing is scheduled there now
    const cleared = await month();
    expect(cleared.prerequisites).toMatchObject({
      missingPeriodCount: 0,
      uncoveredDayCount: 0,
    });
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
    // owner decision (SME R2): approved shifts are not enough — the production day must be certified
    const uncertified = await month();
    expect(uncertified.prerequisites).toMatchObject({
      met: false,
      approved: 3,
      days: 1,
      certifiedDays: 0,
    });
    await env
      .post(
        `production-days/${env.world.unitA1}/2027-03-01/certify`,
        {},
        env.approver,
      )
      .expect(200);
    const body = await month();
    expect(body.policy.version).toBe(2);
    expect(body.prerequisites).toMatchObject({
      met: true,
      approved: 3,
      certifiedDays: 1,
    });
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
    const reopened = await env.rows<{ state: string }>(
      `SELECT state FROM production_day_certifications WHERE unit_id = $1`,
      [env.world.unitA1],
    );
    expect(reopened.map((r) => r.state)).toEqual(['reopened']);
    const audit = await env.rows<{ action: string }>(
      `SELECT action FROM audit_log WHERE entity_type = 'month_close' ORDER BY at`,
    );
    expect(audit.map((a) => a.action)).toContain('month_close.lock');
  });
});
