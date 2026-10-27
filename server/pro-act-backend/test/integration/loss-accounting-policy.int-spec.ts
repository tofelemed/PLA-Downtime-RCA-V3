import { randomUUID } from 'crypto';
import { PeriodMaterializerService } from '../../src/periods/period-materializer.service';
import { ActualsWorld, HOUR } from './support/actuals-world';
import { ApiError } from './support/plan-world';
import { signToken } from './support/test-app';

interface VersionBody {
  id: string;
  version: number;
  state: string;
  inForce: boolean;
  basedOnId: string | null;
  policy: { grain: string; lossBasis: string; identityTolerance: number };
}

interface InForceBody {
  policyId: string;
  policy: { grain: string; lossBasis: string };
}

interface CalendarRow {
  id: string;
  state: string;
  shift_templates: Array<{
    name: string;
    startLocal: string;
    endLocal: string;
  }>;
  operational_day_start: string;
}

/**
 * Production loss accounting policy (declared mode, D1-D12) on real Postgres: versions are maker-checker
 * like the source authority; approving a day-grain version publishes a daily calendar (one 24 h shift)
 * for the policy's scope and replaces the open shift periods it covers by one period per day, unless a
 * period with an approved revision is in the way. Test data only.
 */
describe('loss accounting policy (declared mode, D1-D12)', () => {
  const env = new ActualsWorld();
  let integration = '';
  let accountant = '';
  let checker = '';
  let manager = '';

  beforeAll(async () => {
    await env.start();
    await env.rows(
      `UPDATE sites SET timezone = 'Asia/Tehran', operational_day_start = '06:00' WHERE tenant_id = $1`,
      [env.world.tenantA],
    );
    const { unitA3 } = env.world;
    integration = await env.unitUser(unitA3, 'integration_admin');
    accountant = await env.unitUser(unitA3, 'production_accountant');
    checker = await env.unitUser(unitA3, 'production_accountant');
    manager = await env.unitUser(unitA3, 'manager_approver');
  });
  afterAll(() => env.stop());

  const draft = (token: string, body: Record<string, unknown>) =>
    env
      .post('loss-accounting/versions', body, token)
      .set('Idempotency-Key', randomUUID());
  const decide = (id: string, action: string, token: string, body = {}) =>
    env
      .post(`loss-accounting/versions/${id}/${action}`, body, token)
      .set('Idempotency-Key', randomUUID());
  const inForce = async (unitId = env.world.unitA3, token = accountant) =>
    (await env.get(`loss-accounting?unitId=${unitId}`, token).expect(200))
      .body as InForceBody;
  const calendars = (unitId: string) =>
    env.rows<CalendarRow>(
      `SELECT id, state, shift_templates, operational_day_start FROM calendar_versions
        WHERE unit_id = $1 AND shift_templates @> '[{"name": "Day"}]' ORDER BY version`,
      [unitId],
    );

  it('a draft is not in force; another approver approves it and the shift-grain version publishes no calendar', async () => {
    const before = await inForce();
    expect(before.policy).toMatchObject({
      grain: 'shift',
      lossBasis: 'computed',
    });
    const proposed = (
      await draft(integration, {
        unitId: env.world.unitA3,
        lossBasis: 'declared',
        targetSource: 'declared',
        identityTolerance: 0.5,
      }).expect(201)
    ).body as VersionBody;
    expect(proposed).toMatchObject({
      state: 'proposed',
      inForce: false,
      basedOnId: before.policyId,
      policy: { grain: 'shift', lossBasis: 'declared' },
    });
    expect((await inForce()).policyId).toBe(before.policyId);

    const role = await decide(proposed.id, 'approve', integration).expect(403);
    expect((role.body as ApiError).code).toBe('FORBIDDEN_ROLE');
    const own = (
      await draft(accountant, {
        unitId: env.world.unitA3,
        identityTolerance: 1,
      }).expect(201)
    ).body as VersionBody;
    const sod = await decide(own.id, 'approve', accountant).expect(403);
    expect((sod.body as ApiError).code).toBe('SEPARATION_OF_DUTIES');

    const approved = (
      await decide(proposed.id, 'approve', checker, {
        reason: 'checked',
      }).expect(200)
    ).body as VersionBody;
    expect(approved).toMatchObject({ state: 'approved', inForce: true });
    expect((await inForce()).policyId).toBe(proposed.id);
    expect(await calendars(env.world.unitA3)).toHaveLength(0);
    const stale = await decide(own.id, 'approve', checker).expect(409);
    expect((stale.body as ApiError).code).toBe('STALE_DRAFT');
    const again = await decide(proposed.id, 'approve', checker).expect(409);
    expect((again.body as ApiError).code).toBe('INVALID_TRANSITION');
  });

  it('refuses an invalid body and a unit of another plant; a rejection keeps the version in force', async () => {
    const grain = await draft(integration, {
      unitId: env.world.unitA3,
      grain: 'week',
    }).expect(422);
    expect((grain.body as ApiError).code).toBe('VALIDATION_FAILED');
    const unit = await draft(integration, {
      unitId: env.world.unitA3,
      accountingUnitId: randomUUID(),
    }).expect(422);
    expect((unit.body as ApiError).code).toBe('INVALID_REFERENCE');

    const before = await inForce();
    const proposed = (
      await draft(integration, {
        unitId: env.world.unitA3,
        grain: 'day',
      }).expect(201)
    ).body as VersionBody;
    const rejected = (
      await decide(proposed.id, 'reject', checker, {
        reason: 'not before month end',
      }).expect(200)
    ).body as VersionBody;
    expect(rejected).toMatchObject({ state: 'rejected', inForce: false });
    expect((await inForce()).policyId).toBe(before.policyId);
    expect(await calendars(env.world.unitA3)).toHaveLength(0);
    await env
      .get(`loss-accounting/versions/${proposed.id}`, env.adminB)
      .expect(404);
  });

  it('refuses day grain from a date at which a period already has an approved revision', async () => {
    const unitId = env.world.unitA1;
    const start = new Date(Date.now() - 2 * HOUR);
    const [period] = await env.rows<{ id: string; local_date: string }>(
      `INSERT INTO production_periods (tenant_id, row_version, unit_id, utc_start, utc_end, local_date)
       VALUES ($1, 1, $2, $3::timestamptz, $4::timestamptz, (($3::timestamptz AT TIME ZONE 'UTC') - interval '150 minutes')::date)
       RETURNING id, to_char(local_date, 'YYYY-MM-DD') AS local_date`,
      [env.world.tenantA, unitId, start, new Date(start.getTime() + HOUR)],
    );
    await env.rows(
      `INSERT INTO accounting_revisions (tenant_id, row_version, period_id, revision, lifecycle)
       VALUES ($1, 1, $2, 1, 'approved')`,
      [env.world.tenantA, period.id],
    );
    const author = await env.unitUser(unitId, 'integration_admin');
    const approver = await env.unitUser(unitId, 'production_accountant');
    const proposed = (
      await draft(author, { unitId, grain: 'day', dayStart: '06:00' }).expect(
        201,
      )
    ).body as VersionBody;
    const refused = await decide(proposed.id, 'approve', approver).expect(422);
    expect((refused.body as ApiError).code).toBe('EFFECTIVE_DATE_TOO_EARLY');
    expect((refused.body as ApiError).message).toContain(period.local_date);
    expect((await inForce(unitId, approver)).policy.grain).toBe('shift');
    expect(await calendars(unitId)).toHaveLength(0);
  });

  it('approving a day-grain version publishes a daily calendar and replaces the open shift periods', async () => {
    const unitId = env.world.unitA3;
    const now = Date.now();
    await env.materialize(
      [unitId],
      new Date(now - 72 * HOUR).toISOString(),
      new Date(now).toISOString(),
    );
    const shiftPeriods = await env.rows<{ n: number }>(
      `SELECT count(*)::int AS n FROM production_periods WHERE unit_id = $1 AND utc_end - utc_start = interval '8 hours'`,
      [unitId],
    );
    expect(shiftPeriods[0].n).toBeGreaterThanOrEqual(6);

    const proposed = (
      await draft(integration, {
        unitId,
        grain: 'day',
        dayStart: '06:00',
      }).expect(201)
    ).body as VersionBody;
    const approved = (await decide(proposed.id, 'approve', manager).expect(200))
      .body as VersionBody;
    expect(approved).toMatchObject({
      state: 'approved',
      inForce: true,
      policy: { grain: 'day' },
    });

    const published = await calendars(unitId);
    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({
      state: 'published',
      shift_templates: [
        { name: 'Day', startLocal: '06:00', endLocal: '06:00' },
      ],
    });
    expect(published[0].operational_day_start).toMatch(/^06:00/);
    const instances = await env.rows<{
      n: number;
      days: number;
      first: string;
    }>(
      `SELECT count(*)::int AS n,
              count(*) FILTER (WHERE utc_end - utc_start = interval '24 hours')::int AS days,
              to_char(min(local_date), 'YYYY-MM-DD') AS first
         FROM shift_instances WHERE calendar_version_id = $1`,
      [published[0].id],
    );
    const today = new Date(now + 3.5 * HOUR - 6 * HOUR)
      .toISOString()
      .slice(0, 10);
    expect(instances[0].n).toBeGreaterThan(1);
    expect(instances[0].days).toBe(instances[0].n);
    expect(instances[0].first).toBe(today);

    const periods = await env.rows<{ shift: number; day: number }>(
      `SELECT count(*) FILTER (WHERE utc_end - utc_start = interval '8 hours' AND local_date >= $2::date)::int AS shift,
              count(*) FILTER (WHERE utc_end - utc_start = interval '24 hours' AND local_date = $2::date)::int AS day
         FROM production_periods WHERE unit_id = $1`,
      [unitId, today],
    );
    expect(periods[0]).toEqual({ shift: 0, day: 1 });
    const earlier = await env.rows<{ n: number }>(
      `SELECT count(*)::int AS n FROM production_periods WHERE unit_id = $1 AND local_date < $2::date`,
      [unitId, today],
    );
    expect(earlier[0].n).toBeGreaterThan(0);

    const next = (
      await draft(integration, { unitId, identityTolerance: 2 }).expect(201)
    ).body as VersionBody;
    expect(next.policy.grain).toBe('day');
    await decide(next.id, 'approve', manager).expect(200);
    expect(await calendars(unitId)).toHaveLength(1);
  });

  /** A user holding a role on each of the given units (one scope row each). */
  async function multiUnitUser(
    grants: Array<[string, string]>,
  ): Promise<string> {
    const userId = randomUUID();
    await env.rows(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id) VALUES ($1, 'unit user', $2, 'x', 'Operator', $3)`,
      [userId, `${userId}@test.local`, env.world.tenantA],
    );
    for (const [unitId, role] of grants) {
      await env.rows(
        `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version) VALUES ($1, $2, 'unit', $3, $4, 1)`,
        [env.world.tenantA, userId, unitId, role],
      );
    }
    return signToken(env.app, {
      userId,
      tenantId: env.world.tenantA,
      role: 'Operator',
    });
  }

  it('needs the writer and approver role on the accounting unit as well as on the version unit', async () => {
    const { unitA2, unitA3 } = env.world;
    const body = { unitId: unitA3, accountingUnitId: unitA2 };
    const viewerOnA2 = await multiUnitUser([
      [unitA3, 'integration_admin'],
      [unitA2, 'viewer'],
    ]);
    const refused = await draft(viewerOnA2, body).expect(403);
    expect((refused.body as ApiError).code).toBe('FORBIDDEN_ROLE');

    const author = await multiUnitUser([
      [unitA3, 'integration_admin'],
      [unitA2, 'integration_admin'],
    ]);
    const proposed = (await draft(author, body).expect(201))
      .body as VersionBody;
    const approver = await multiUnitUser([
      [unitA3, 'production_accountant'],
      [unitA2, 'viewer'],
    ]);
    const denied = await decide(proposed.id, 'approve', approver).expect(403);
    expect((denied.body as ApiError).code).toBe('FORBIDDEN_ROLE');
    await decide(proposed.id, 'reject', checker, {
      reason: 'test cleanup',
    }).expect(403);
  });

  it('a retry after a failure late in the approval (all rolled back but the draft) still replaces the open periods', async () => {
    const unitId = env.world.unitA2;
    const now = Date.now();
    await env.materialize(
      [unitId],
      new Date(now - 72 * HOUR).toISOString(),
      new Date(now).toISOString(),
    );
    const author = await env.unitUser(unitId, 'integration_admin');
    const approver = await env.unitUser(unitId, 'production_accountant');
    const proposed = (
      await draft(author, { unitId, grain: 'day', dayStart: '06:00' }).expect(
        201,
      )
    ).body as VersionBody;
    const failing = jest
      .spyOn(env.app.get(PeriodMaterializerService), 'materialize')
      .mockRejectedValueOnce(new Error('materialization failed'));
    await decide(proposed.id, 'approve', approver).expect(500);
    failing.mockRestore();

    const after = (
      await env
        .get(`loss-accounting/versions/${proposed.id}`, approver)
        .expect(200)
    ).body as VersionBody;
    expect(after.state).toBe('proposed');
    expect(await calendars(unitId)).toHaveLength(1);
    const today = new Date(now + 3.5 * HOUR - 6 * HOUR)
      .toISOString()
      .slice(0, 10);
    const count = async (hours: number) =>
      (
        await env.rows<{ n: number }>(
          `SELECT count(*)::int AS n FROM production_periods WHERE unit_id = $1
              AND utc_end - utc_start = make_interval(hours => $3) AND local_date >= $2::date`,
          [unitId, today, hours],
        )
      )[0].n;
    expect(await count(8)).toBeGreaterThan(0);

    await decide(proposed.id, 'approve', approver).expect(200);
    expect(await calendars(unitId)).toHaveLength(1);
    expect(await count(8)).toBe(0);
    expect(await count(24)).toBe(1);
  });
});
