import { randomUUID } from 'crypto';
import { CalendarMaterializerService } from '../../src/calendar/calendar-materializer.service';
import { SitesService } from '../../src/calendar/sites.service';
import { addDays } from '../../src/domain/calendar/wall-clock';
import { ActualsWorld, HOUR } from './support/actuals-world';

interface ApprovalBody {
  state: string;
  policy: { accountingProductId: string | null; dayStart: string };
  calendar: {
    versionId: string;
    effectiveFrom: string;
    retired: number;
    kept: number;
  } | null;
}

interface PolicyFields {
  dayStart?: string;
  accountingProductId?: string;
}

/**
 * A version that follows an approved day-grain switch (3-shift site calendar, Asia/Tehran, daily
 * calendar from tomorrow because today's shifts are calculated): settings only (same grain, day start
 * and scope) adopt the published daily calendar; a different day start plans a new switch. Test data only.
 */
describe('loss accounting policy: a version after a day-grain switch', () => {
  const env = new ActualsWorld();
  let today = '';

  beforeAll(async () => {
    await env.start();
    await env.rows(
      `UPDATE sites SET timezone = 'Asia/Tehran', operational_day_start = '06:00' WHERE tenant_id = $1`,
      [env.world.tenantA],
    );
    today = new Date(Date.now() + 3.5 * HOUR).toISOString().slice(0, 10);
  });
  afterAll(() => env.stop());

  async function freshUnit(): Promise<string> {
    const id = randomUUID();
    await env.rows(
      `INSERT INTO units (id, code, name, tenant_id, organization_id) VALUES ($1, $2, $2, $3, $4)`,
      [id, `st-${id.slice(0, 8)}`, env.world.tenantA, env.world.organizationId],
    );
    const site = await env.app.get(SitesService).defaultSite(env.world.tenantA);
    await env.app.get(CalendarMaterializerService).materialize({
      site,
      unitIds: [id],
      from: addDays(today, -3),
      to: addDays(today, 3),
      replaceFrom: null,
      actorId: null,
    });
    return id;
  }

  /** The period of a shift instance of the unit (created from the instance when missing). */
  async function period(
    unitId: string,
    localDate: string,
    shift: string,
  ): Promise<string> {
    await env.rows(
      `INSERT INTO production_periods (tenant_id, row_version, unit_id, shift_instance_id, calendar_version_id,
              utc_start, utc_end, local_date, shift_name)
       SELECT si.tenant_id, 1, si.unit_id, si.id, si.calendar_version_id, si.utc_start, si.utc_end, si.local_date, si.shift_name
         FROM shift_instances si WHERE si.unit_id = $1 AND si.local_date = $2::date AND si.shift_name = $3
          AND NOT EXISTS (SELECT 1 FROM production_periods p WHERE p.shift_instance_id = si.id)`,
      [unitId, localDate, shift],
    );
    const [row] = await env.rows<{ id: string }>(
      `SELECT p.id FROM production_periods p JOIN shift_instances si ON si.id = p.shift_instance_id
        WHERE si.unit_id = $1 AND si.local_date = $2::date AND si.shift_name = $3`,
      [unitId, localDate, shift],
    );
    return row.id;
  }

  const calculated = (periodId: string) =>
    env.rows(
      `INSERT INTO actuals_runs (tenant_id, row_version, period_id, trigger, input_hash, engine_version, policy_versions, computed_at)
       VALUES ($1, 1, $2, 'test', 'h', 't', '{}', now())`,
      [env.world.tenantA, periodId],
    );

  const calendarsOf = (unitId: string) =>
    env.rows<{ id: string; state: string; effective_from: string }>(
      `SELECT id, state, to_char(effective_from, 'YYYY-MM-DD') AS effective_from
         FROM calendar_versions WHERE unit_id = $1 ORDER BY version`,
      [unitId],
    );

  /** Drafts a day-grain version for the unit, approves it as another user and expects the status. */
  async function approveDay(
    unitId: string,
    status: number,
    fields: PolicyFields = {},
  ): Promise<ApprovalBody & { code?: string; message?: string }> {
    const author = await env.unitUser(unitId, 'integration_admin');
    const approver = await env.unitUser(unitId, 'manager_approver');
    const draft = await env
      .post(
        'loss-accounting/versions',
        {
          unitId,
          grain: 'day',
          dayStart: '00:00',
          lossBasis: 'declared',
          ...fields,
        },
        author,
      )
      .expect(201);
    const id = (draft.body as { id: string }).id;
    const res = await env.post(
      `loss-accounting/versions/${id}/approve`,
      {},
      approver,
    );
    expect({ status: res.status, body: res.body as unknown }).toMatchObject({
      status,
    });
    return res.body as ApprovalBody;
  }

  /** Today's A and B calculated: the switch lands on tomorrow. */
  async function switchedFromTomorrow(unitId: string): Promise<string> {
    await calculated(await period(unitId, today, 'A'));
    await calculated(await period(unitId, today, 'B'));
    const body = await approveDay(unitId, 200);
    expect(body.calendar?.effectiveFrom).toBe(addDays(today, 1));
    return body.calendar?.versionId ?? '';
  }

  it('a version changing only the accounting product adopts the daily calendar that starts tomorrow', async () => {
    const unitId = await freshUnit();
    const next = addDays(today, 1);
    const dailyId = await switchedFromTomorrow(unitId);
    // tomorrow's daily period already approved: a fresh switch from today would be refused (422)
    const tomorrow = await period(unitId, next, 'Day');
    await env.rows(
      `INSERT INTO accounting_revisions (tenant_id, row_version, period_id, revision, lifecycle)
       VALUES ($1, 1, $2, 1, 'approved')`,
      [env.world.tenantA, tomorrow],
    );

    const body = await approveDay(unitId, 200, {
      accountingProductId: env.products.p1,
    });
    expect(body.state).toBe('approved');
    expect(body.policy.accountingProductId).toBe(env.products.p1);
    expect(body.calendar).toMatchObject({
      versionId: dailyId,
      effectiveFrom: next,
    });
    expect(await calendarsOf(unitId)).toEqual([
      { id: dailyId, state: 'published', effective_from: next },
    ]);
    const kept = await env.rows(
      `SELECT id FROM production_periods WHERE id = $1`,
      [tomorrow],
    );
    expect(kept).toHaveLength(1);
  });

  it('a version with another day start plans a new switch', async () => {
    const unitId = await freshUnit();
    await switchedFromTomorrow(unitId);
    const tomorrow = await period(unitId, addDays(today, 1), 'Day');
    await env.rows(
      `INSERT INTO accounting_revisions (tenant_id, row_version, period_id, revision, lifecycle)
       VALUES ($1, 1, $2, 1, 'approved')`,
      [env.world.tenantA, tomorrow],
    );
    const refused = await approveDay(unitId, 422, { dayStart: '06:00' });
    expect(refused.code).toBe('EFFECTIVE_DATE_TOO_EARLY');
  });

  it('another day start with no approved daily period publishes a second daily calendar from the same date (follow-up: gap)', async () => {
    const unitId = await freshUnit();
    const next = addDays(today, 1);
    const firstId = await switchedFromTomorrow(unitId);
    const body = await approveDay(unitId, 200, { dayStart: '06:00' });
    expect(body.calendar?.effectiveFrom).toBe(next);
    const secondId = body.calendar?.versionId ?? '';
    expect(secondId).not.toBe(firstId);
    // the first daily calendar stays published and open-ended, shadowed by the higher version
    expect(await calendarsOf(unitId)).toEqual([
      { id: firstId, state: 'published', effective_from: next },
      { id: secondId, state: 'published', effective_from: next },
    ]);
    const sixAm = new Date(`${next}T06:00:00+03:30`);
    const [first] = await env.rows<{
      calendar_version_id: string;
      utc_start: Date;
    }>(
      `SELECT calendar_version_id, utc_start FROM shift_instances
        WHERE unit_id = $1 AND utc_end > $2 ORDER BY utc_start LIMIT 1`,
      [unitId, new Date(`${next}T00:00:00+03:30`)],
    );
    expect(first.calendar_version_id).toBe(secondId);
    expect(new Date(first.utc_start)).toEqual(sixAm);
  });
});
