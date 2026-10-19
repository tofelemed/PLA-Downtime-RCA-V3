import { randomUUID } from 'crypto';
import { ApiError } from './support/plan-world';
import {
  ReconciliationBody,
  ReconciliationWorld,
} from './support/reconciliation-world';

const DAY_MS = 86_400_000;

interface SlaBody {
  sla: {
    stage: string;
    overdue: boolean;
    escalationLevel: number;
    escalatedTo: string | null;
    rejections: number;
    rejectionEscalated: boolean;
    onHold: boolean;
    submitDueAt: string;
    ageSeconds: number;
  };
  holds: Array<{ kind: string; endedAt: string | null }>;
  lastRejection: {
    failedLines: string[];
    resubmitDueAt: string | null;
    rejection: number | null;
    escalated: boolean;
    escalatedTo: string | null;
  } | null;
}

interface QueueBody {
  items: Array<{
    periodId: string;
    task: string;
    overdue: boolean;
    escalationLevel: number;
    rejectionEscalated: boolean;
    onHold: boolean;
    dueAt: string;
  }>;
  nextCursor: string | null;
}

interface StatusBody {
  data: {
    overdueCount: number;
    waitingForData: number;
    rejectionEscalated: number;
    escalated: Array<{ level: number; role: string; periods: number }>;
    sla: { version: number; submitWithinHours: number };
    overdue: Array<{ periodId: string; sla: { overdue: boolean } | null }>;
  };
}

/**
 * SME R3 / R6 (phase R-C) on real Postgres. Past periods of unit A3 (daily, one per operational date, ended
 * before today) cover each SLA case: never reconciled 4 days ago (overdue, escalated to plant management),
 * in review since yesterday (due tomorrow) and since the day before (overdue), waiting for the lab (paused),
 * approved, and a draft rejected three times (rejection escalation). The status report counts (SQL) agree
 * with the period SLA (domain) and "My queue" lists each role's work earliest due first. Rejection names the
 * failed line and the new due time on the world's 2027 shift period.
 */
describe('reconciliation SLA, waiting for data, rejection and my queue (SME R3 / R6)', () => {
  const env = new ReconciliationWorld();
  const today = new Date(Math.floor(Date.now() / DAY_MS) * DAY_MS);
  const day = (offset: number) => new Date(today.getTime() + offset * DAY_MS);
  const ids: Record<string, string> = {};
  let reason = '';

  /**
   * A 24 h period of unit A3 on the UTC date `offset` days from today, with an optional revision; planned
   * (resolved against the world's approved plan version) unless `planned` is false.
   */
  const pastPeriod = async (
    key: string,
    offset: number,
    lifecycle: string | null,
    planned = true,
  ): Promise<void> => {
    const id = randomUUID();
    await env.rows(
      `INSERT INTO production_periods (id, tenant_id, row_version, unit_id, utc_start, utc_end, local_date, selected_plan_version_id)
       VALUES ($1, $2, 1, $3, $4, $5, $6::date,
               CASE WHEN $7::boolean THEN (SELECT v.id FROM plan_versions v
                                            WHERE v.tenant_id = $2 AND v.approval_state = 'approved'
                                            ORDER BY v.created_at LIMIT 1) END)`,
      [
        id,
        env.world.tenantA,
        env.world.unitA3,
        day(offset),
        day(offset + 1),
        day(offset).toISOString().slice(0, 10),
        planned,
      ],
    );
    if (lifecycle) {
      await env.rows(
        `INSERT INTO accounting_revisions (id, tenant_id, row_version, period_id, revision, lifecycle, is_stale, submitted_by)
         VALUES ($1, $2, 1, $3, 1, $4::accounting_revision_lifecycle, false, $5)`,
        [
          randomUUID(),
          env.world.tenantA,
          id,
          lifecycle,
          lifecycle === 'in_review' ? randomUUID() : null,
        ],
      );
    }
    ids[key] = id;
  };

  const sla = async (key: string) =>
    (await env.get(`production-periods/${ids[key]}/sla`).expect(200))
      .body as SlaBody;

  beforeAll(async () => {
    await env.start();
    reason = await env.reasonCode('FEED');
    await pastPeriod('neverReconciled', -4, null);
    await pastPeriod('reviewDueTomorrow', -1, 'in_review');
    await pastPeriod('reviewOverdue', -2, 'in_review');
    await pastPeriod('waitingForLab', -5, 'draft');
    await pastPeriod('approved', -3, 'approved');
    await pastPeriod('rejectedThrice', -6, 'draft');
    await pastPeriod('apiHold', -7, null);
    // owner decision 2026-10-19: a period no approved plan covers is no work item
    await pastPeriod('noPlan', -9, null, false);
    // the lab hold started when its production day ended: the whole wait is paused
    await env.rows(
      `INSERT INTO period_data_holds (tenant_id, row_version, period_id, unit_id, kind, reason, started_at)
       VALUES ($1, 1, $2, $3, 'lab', 'Demo: waiting for the lab', $4)`,
      [env.world.tenantA, ids.waitingForLab, env.world.unitA3, day(-4)],
    );
    const [rejected] = await env.rows<{ id: string }>(
      `SELECT id FROM accounting_revisions WHERE period_id = $1`,
      [ids.rejectedThrice],
    );
    for (let i = 0; i < 3; i += 1) {
      await env.rows(
        `INSERT INTO approval_actions (tenant_id, row_version, revision_id, period_id, action, from_lifecycle, to_lifecycle, created_at)
         VALUES ($1, 1, $2, $3, 'reject', 'in_review', 'draft', $4)`,
        [env.world.tenantA, rejected.id, ids.rejectedThrice, day(-5)],
      );
    }
  });
  afterAll(() => env.stop());

  it('waiting for the lab pauses the clock; a second hold and a hold on an approved period are refused', async () => {
    const opened = (
      await env
        .post(`production-periods/${ids.apiHold}/data-holds`, {
          kind: 'source',
          reason: 'the source system failed',
        })
        .expect(200)
    ).body as SlaBody;
    expect(opened.sla).toMatchObject({
      stage: 'waiting_for_data',
      onHold: true,
      overdue: false,
    });
    const twice = await env
      .post(`production-periods/${ids.apiHold}/data-holds`, {
        kind: 'lab',
        reason: 'again',
      })
      .expect(409);
    expect((twice.body as ApiError).code).toBe('HOLD_OPEN');
    const approved = await env
      .post(`production-periods/${ids.approved}/data-holds`, {
        kind: 'source',
        reason: 'x',
      })
      .expect(409);
    expect((approved.body as ApiError).code).toBe('PERIOD_APPROVED');
    const bad = await env
      .post(`production-periods/${ids.neverReconciled}/data-holds`, {
        kind: 'weather',
        reason: 'x',
      })
      .expect(422);
    expect((bad.body as ApiError).code).toBeDefined();
  });

  it('the period SLA follows the policy: overdue, escalation and rejection escalation', async () => {
    expect((await sla('waitingForLab')).sla).toMatchObject({
      stage: 'waiting_for_data',
      overdue: false,
      escalationLevel: 0,
      ageSeconds: 0,
    });
    expect((await sla('neverReconciled')).sla).toMatchObject({
      stage: 'preparation',
      overdue: true,
      escalationLevel: 2,
      escalatedTo: 'manager_approver',
    });
    expect((await sla('reviewDueTomorrow')).sla).toMatchObject({
      stage: 'review',
      overdue: false,
      escalationLevel: 0,
    });
    expect((await sla('reviewOverdue')).sla).toMatchObject({
      stage: 'review',
      overdue: true,
    });
    expect((await sla('approved')).sla).toMatchObject({
      stage: 'done',
      overdue: false,
    });
    expect((await sla('rejectedThrice')).sla).toMatchObject({
      rejections: 3,
      rejectionEscalated: true,
      overdue: true,
    });
  });

  it('the status report counts with the same verdicts in SQL (no overdueAfterHours parameter any more)', async () => {
    const window = `from=${encodeURIComponent(day(-8).toISOString())}&to=${encodeURIComponent(day(0).toISOString())}`;
    const scope = `unitIds=${env.world.unitA3}&${window}`;
    const status = (
      await env.get(`reports/reconciliation-status?${scope}`).expect(200)
    ).body as StatusBody;
    expect(status.data).toMatchObject({
      overdueCount: 3,
      waitingForData: 2,
      rejectionEscalated: 1,
      sla: { version: 1, submitWithinHours: 12 },
    });
    const level2 = status.data.escalated.find((e) => e.level === 2);
    expect(level2?.periods).toBeGreaterThanOrEqual(2);
    expect(status.data.overdue.map((o) => o.periodId).sort()).toEqual(
      [ids.neverReconciled, ids.reviewOverdue, ids.rejectedThrice].sort(),
    );
    expect(status.data.overdue.every((o) => o.sla?.overdue === true)).toBe(
      true,
    );
    const legacy = await env
      .get(`reports/reconciliation-status?${scope}&overdueAfterHours=48`)
      .expect(422);
    expect((legacy.body as ApiError).code).toBeDefined();
  });

  it('my queue: production accounting sees escalations and reviews, earliest due first, keyset paged', async () => {
    const accountant = await env.scopedUser('production_accountant');
    const seen: QueueBody['items'] = [];
    let cursor: string | null = null;
    do {
      const query: string = cursor ? `&cursor=${cursor}` : '';
      const page = (
        await env
          .get(`reconciliation-queue?limit=2${query}`, accountant)
          .expect(200)
      ).body as QueueBody;
      seen.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor);
    const byId = new Map(seen.map((item) => [item.periodId, item]));
    expect(byId.has(ids.approved)).toBe(false);
    expect(byId.has(ids.noPlan)).toBe(false);
    expect(byId.get(ids.neverReconciled)).toMatchObject({
      task: 'escalated',
      overdue: true,
      escalationLevel: 2,
    });
    expect(byId.get(ids.rejectedThrice)).toMatchObject({
      task: 'escalated',
      rejectionEscalated: true,
    });
    expect(byId.get(ids.reviewDueTomorrow)?.task).toBe('review');
    expect(byId.get(ids.waitingForLab)).toMatchObject({
      task: 'prepare',
      onHold: true,
      overdue: false,
    });
    expect(byId.get(ids.apiHold)).toMatchObject({
      onHold: true,
      overdue: false,
    });
    const dues = seen.map((item) => item.dueAt);
    expect(dues).toEqual([...dues].sort());
    for (const key of Object.keys(ids).filter(
      (k) => k !== 'approved' && k !== 'noPlan',
    )) {
      const periodSla = (await sla(key)).sla;
      expect([key, byId.get(ids[key])?.overdue]).toEqual([
        key,
        periodSla.overdue,
      ]);
    }
  });

  it('releasing the hold restarts the clock', async () => {
    const released = (
      await env
        .post(`production-periods/${ids.apiHold}/data-holds/release`, {
          note: 'lab result arrived',
        })
        .expect(200)
    ).body as SlaBody;
    expect(released.sla).toMatchObject({ onHold: false, overdue: true });
    expect(released.holds[0].endedAt).not.toBeNull();
    const again = await env
      .post(`production-periods/${ids.apiHold}/data-holds/release`, {})
      .expect(409);
    expect((again.body as ApiError).code).toBe('NO_OPEN_HOLD');
  });

  it('rejection: the failed line must be in the revision; the reason, line and new due time return to the preparer', async () => {
    const draft = await env.view();
    const lines = env.rejectAllPlus(
      draft,
      draft.slices[0].gap as string,
      reason,
    );
    await env.saveLines(draft, lines).expect(200);
    await env.submit(await env.view()).expect(200);
    const submitted = await env.view();
    const bogus = await env
      .post(
        `production-periods/${env.periodA1}/reject`,
        {
          revision: submitted.revision.revision,
          reason: 'x',
          failedLines: ['not-a-line'],
        },
        env.approver,
      )
      .expect(422);
    expect((bogus.body as ApiError).code).toBe('INVALID_REFERENCE');
    const lineId = (submitted.lines as Array<{ id?: string }>)[0]?.id ?? '';
    await env
      .post(
        `production-periods/${env.periodA1}/reject`,
        {
          revision: submitted.revision.revision,
          reason: 'the event supports only 15 t',
          failedLines: [lineId],
        },
        env.approver,
      )
      .expect(200);
    const after = (await env.get(`production-periods/${env.periodA1}/sla`))
      .body as SlaBody;
    expect(after.lastRejection).toMatchObject({
      failedLines: [lineId],
      rejection: 1,
      escalated: false,
    });
    expect(after.lastRejection?.resubmitDueAt).toBe(after.sla.submitDueAt);
  });

  it('the third rejection of the same revision escalates to production accounting', async () => {
    for (let n = 2; n <= 3; n += 1) {
      await env.submit(await env.view()).expect(200);
      const submitted: ReconciliationBody = await env.view();
      await env
        .post(
          `production-periods/${env.periodA1}/reject`,
          { revision: submitted.revision.revision, reason: `rejection ${n}` },
          env.approver,
        )
        .expect(200);
    }
    const after = (await env.get(`production-periods/${env.periodA1}/sla`))
      .body as SlaBody;
    expect(after.lastRejection).toMatchObject({
      rejection: 3,
      escalated: true,
      escalatedTo: 'production_accountant',
    });
    const history = (
      await env.get(`production-periods/${env.periodA1}/approval-actions`)
    ).body as {
      items: Array<{ action: string; detail: Record<string, unknown> }>;
    };
    expect(history.items[0]).toMatchObject({
      action: 'reject',
      detail: { rejection: 3, escalated: true },
    });
  });
});
