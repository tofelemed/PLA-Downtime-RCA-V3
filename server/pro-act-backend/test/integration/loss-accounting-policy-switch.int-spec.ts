import { randomUUID } from 'crypto';
import { CalendarMaterializerService } from '../../src/calendar/calendar-materializer.service';
import { SitesService } from '../../src/calendar/sites.service';
import { addDays } from '../../src/domain/calendar/wall-clock';
import { PeriodMaterializerService } from '../../src/periods/period-materializer.service';
import { ActualsWorld, HOUR } from './support/actuals-world';

interface ApprovalBody {
  state: string;
  calendar: {
    versionId: string;
    effectiveFrom: string;
    retired: number;
    kept: number;
  } | null;
}

interface InstanceRow {
  id: string;
  utc_start: Date;
  utc_end: Date;
  local_end: string;
}

/** Plant-local midnight (Asia/Tehran, +03:30) of a date. */
const midnight = (date: string): Date => new Date(`${date}T00:00:00+03:30`);

/**
 * Day-grain switch on a 3-shift site calendar (A 06-14, B 14-22, C 22-06, Asia/Tehran) with a 00:00
 * day start (declared mode, D12 follow-up): the daily calendar starts at the first midnight on or after
 * the effective date that is not before the end of the last calculated period; old shifts from there on
 * are removed with their open periods and the C shift crossing it ends there. Test data only.
 */
describe('loss accounting policy: day-grain switch (declared mode, D12)', () => {
  const env = new ActualsWorld();
  // plant-local date now with a 00:00 day start: the approval's effective operational date
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

  /** A new unit of tenant A with the site calendar's instances around today. */
  async function freshUnit(): Promise<string> {
    const id = randomUUID();
    await env.rows(
      `INSERT INTO units (id, code, name, tenant_id, organization_id) VALUES ($1, $2, $2, $3, $4)`,
      [id, `sw-${id.slice(0, 8)}`, env.world.tenantA, env.world.organizationId],
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

  /** The period copied from a shift instance of the unit. */
  async function period(
    unitId: string,
    localDate: string,
    shift: string,
  ): Promise<string> {
    const [row] = await env.rows<{ id: string }>(
      `INSERT INTO production_periods (tenant_id, row_version, unit_id, shift_instance_id, calendar_version_id,
              utc_start, utc_end, local_date, shift_name)
       SELECT tenant_id, 1, unit_id, id, calendar_version_id, utc_start, utc_end, local_date, shift_name
         FROM shift_instances WHERE unit_id = $1 AND local_date = $2::date AND shift_name = $3
       RETURNING id`,
      [unitId, localDate, shift],
    );
    return row.id;
  }

  /** Calculation history: an actuals run of the period. */
  const calculated = (periodId: string) =>
    env.rows(
      `INSERT INTO actuals_runs (tenant_id, row_version, period_id, trigger, input_hash, engine_version, policy_versions, computed_at)
       VALUES ($1, 1, $2, 'test', 'h', 't', '{}', now())`,
      [env.world.tenantA, periodId],
    );

  async function approveDaily(unitId: string): Promise<{
    id: string;
    approver: string;
  }> {
    const author = await env.unitUser(unitId, 'integration_admin');
    const approver = await env.unitUser(unitId, 'manager_approver');
    const draft = await env
      .post(
        'loss-accounting/versions',
        { unitId, grain: 'day', dayStart: '00:00', lossBasis: 'declared' },
        author,
      )
      .expect(201);
    return { id: (draft.body as { id: string }).id, approver };
  }

  const approve = (id: string, token: string) =>
    env.post(`loss-accounting/versions/${id}/approve`, {}, token);

  const instance = async (unitId: string, localDate: string, shift: string) =>
    (
      await env.rows<InstanceRow>(
        `SELECT id, utc_start, utc_end, local_end FROM shift_instances
          WHERE unit_id = $1 AND local_date = $2::date AND shift_name = $3`,
        [unitId, localDate, shift],
      )
    )[0];

  const calendarsOf = (unitId: string) =>
    env.rows<{ id: string; state: string; effective_from: string }>(
      `SELECT id, state, to_char(effective_from, 'YYYY-MM-DD') AS effective_from
         FROM calendar_versions WHERE unit_id = $1 ORDER BY version`,
      [unitId],
    );

  async function expectDailyFrom(
    unitId: string,
    calendarId: string,
    date: string,
  ) {
    const [old] = await env.rows<{ n: number }>(
      `SELECT count(*)::int AS n FROM shift_instances
        WHERE unit_id = $1 AND calendar_version_id <> $2 AND utc_start >= $3`,
      [unitId, calendarId, midnight(date)],
    );
    expect(old.n).toBe(0);
    const [daily] = await env.rows<{
      n: number;
      days: number;
      first: string;
      start: Date;
    }>(
      `SELECT count(*)::int AS n,
              count(*) FILTER (WHERE utc_end - utc_start = interval '24 hours')::int AS days,
              to_char(min(local_date), 'YYYY-MM-DD') AS first, min(utc_start) AS start
         FROM shift_instances WHERE calendar_version_id = $1`,
      [calendarId],
    );
    expect(daily.n).toBeGreaterThan(1);
    expect(daily.days).toBe(daily.n);
    expect(daily.first).toBe(date);
    expect(new Date(daily.start)).toEqual(midnight(date));
  }

  it('starts the day after the last calculated shift, clips shift C of that day and reuses an orphan draft', async () => {
    const unitId = await freshUnit();
    const next = addDays(today, 1);
    await period(unitId, today, 'A');
    const shiftB = await period(unitId, today, 'B');
    await calculated(shiftB);
    const openAfter = await period(unitId, next, 'A');
    const orphan = await env
      .post('calendar-versions', {
        unitId,
        timezone: 'Asia/Tehran',
        operationalDayStart: '00:00',
        shiftTemplates: [
          { name: 'Day', startLocal: '00:00', endLocal: '00:00' },
        ],
        effectiveFrom: today,
      })
      .expect(201);
    const orphanId = (orphan.body as { id: string }).id;

    const { id, approver } = await approveDaily(unitId);
    const body = (await approve(id, approver).expect(200)).body as ApprovalBody;
    expect(body.state).toBe('approved');
    expect(body.calendar).toMatchObject({
      versionId: orphanId,
      effectiveFrom: next,
      retired: 1,
      kept: 0,
    });
    expect(await calendarsOf(unitId)).toEqual([
      { id: orphanId, state: 'published', effective_from: next },
    ]);

    const shiftC = await instance(unitId, today, 'C');
    expect(new Date(shiftC.utc_end)).toEqual(midnight(next));
    expect(shiftC.local_end).toBe(`${next}T00:00:00+03:30`);
    await expectDailyFrom(unitId, orphanId, next);
    const left = await env.rows<{ id: string }>(
      `SELECT id FROM production_periods WHERE id = ANY($1::uuid[])`,
      [[shiftB, openAfter]],
    );
    expect(left.map((row) => row.id)).toEqual([shiftB]);

    const [audit] = await env.rows<{
      detail: { dailyCalendar: { effectiveFrom: string } };
    }>(
      `SELECT detail FROM audit_log WHERE entity_id = $1 AND action = 'loss_accounting.approved'`,
      [id],
    );
    expect(audit.detail.dailyCalendar.effectiveFrom).toBe(next);
  });

  it('starts today when today has no calculated shift, clips yesterday C with its period, and converges on retry', async () => {
    const unitId = await freshUnit();
    const yesterday = addDays(today, -1);
    await calculated(await period(unitId, yesterday, 'B'));
    const shiftC = await period(unitId, yesterday, 'C');
    const [cWindow] = await env.rows<{ utc_start: Date; utc_end: Date }>(
      `SELECT utc_start, utc_end FROM production_periods WHERE id = $1`,
      [shiftC],
    );
    await env.rows(
      `INSERT INTO period_product_slices (tenant_id, row_version, period_id, product_id, source, window_from, window_to)
       VALUES ($1, 1, $2, $3, 'profile_default', $4, $5)`,
      [
        env.world.tenantA,
        shiftC,
        env.products.p1,
        cWindow.utc_start,
        cWindow.utc_end,
      ],
    );
    const shiftA = await period(unitId, today, 'A');

    const { id, approver } = await approveDaily(unitId);
    const failing = jest
      .spyOn(env.app.get(PeriodMaterializerService), 'materialize')
      .mockRejectedValueOnce(new Error('materialization failed'));
    await approve(id, approver).expect(500);
    failing.mockRestore();
    expect(await calendarsOf(unitId)).toHaveLength(1);

    const body = (await approve(id, approver).expect(200)).body as ApprovalBody;
    expect(body.calendar).toMatchObject({ effectiveFrom: today, kept: 0 });
    const calendars = await calendarsOf(unitId);
    expect(calendars).toEqual([
      {
        id: body.calendar?.versionId,
        state: 'published',
        effective_from: today,
      },
    ]);

    const switchAt = midnight(today);
    const instanceC = await instance(unitId, yesterday, 'C');
    expect(new Date(instanceC.utc_end)).toEqual(switchAt);
    const [periodC] = await env.rows<{ utc_end: Date; window_to: Date }>(
      `SELECT p.utc_end, s.window_to FROM production_periods p
         JOIN period_product_slices s ON s.period_id = p.id WHERE p.id = $1`,
      [shiftC],
    );
    expect(new Date(periodC.utc_end)).toEqual(switchAt);
    expect(new Date(periodC.window_to)).toEqual(switchAt);
    await expectDailyFrom(unitId, calendars[0].id, today);
    const retired = await env.rows(
      `SELECT id FROM production_periods WHERE id = $1`,
      [shiftA],
    );
    expect(retired).toHaveLength(0);
  });
});
