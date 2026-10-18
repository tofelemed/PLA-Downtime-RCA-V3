import { randomUUID } from 'crypto';
import { ActualsWorld, HOUR } from './support/actuals-world';
import { ApiError } from './support/plan-world';

const DAY = 24 * HOUR;

interface VersionBody {
  id: string;
  state: string;
  effectiveFrom: string;
  requestedEffectiveFrom: string | null;
  backdateReason: string | null;
}

interface OverlapError {
  code: string;
  details: { total: number; periods: Array<{ periodId: string }> };
}

/**
 * Owner, 18 Oct 2026 (DECISIONS "Marun HDPE training plant", commissioning backdate) on real Postgres: a
 * policy version normally effective at approval / record time may take effect from a past instant, with a
 * reason, only while no calculated period of the unit (every unit for a plant-wide version) overlaps
 * [effectiveFrom, now); a source authority draft is checked again at approval and takes effect at the
 * requested instant. Test data only.
 */
describe('commissioning backdate of policies (owner, 18 Oct 2026)', () => {
  const env = new ActualsWorld();
  let integration = '';
  let checker = '';
  let manager = '';

  beforeAll(async () => {
    await env.start();
    const { unitA3 } = env.world;
    integration = await env.unitUser(unitA3, 'integration_admin');
    checker = await env.unitUser(unitA3, 'production_accountant');
    manager = await env.unitUser(unitA3, 'manager_approver');
  });
  afterAll(() => env.stop());

  const ago = (days: number) => new Date(Date.now() - days * DAY);

  /** A period of the unit with a validated calculation run (a calculated period). */
  async function calculatedPeriod(
    unitId: string,
    start: Date,
  ): Promise<string> {
    const [period] = await env.rows<{ id: string }>(
      `INSERT INTO production_periods (tenant_id, row_version, unit_id, utc_start, utc_end, local_date)
       VALUES ($1, 1, $2, $3::timestamptz, $4::timestamptz, ($3::timestamptz)::date) RETURNING id`,
      [env.world.tenantA, unitId, start, new Date(start.getTime() + 8 * HOUR)],
    );
    const [revision] = await env.rows<{ id: string }>(
      `INSERT INTO accounting_revisions (tenant_id, row_version, period_id, revision, lifecycle)
       VALUES ($1, 1, $2, 1, 'draft') RETURNING id`,
      [env.world.tenantA, period.id],
    );
    await env.rows(
      `INSERT INTO calculation_runs (tenant_id, row_version, period_id, revision_id, trigger, engine_version,
              policy_versions, input_fingerprint, input_hash, status, started_at)
       VALUES ($1, 1, $2, $3, 'test', 'test', '[]', '{}', 'test', 'validated', now())`,
      [env.world.tenantA, period.id, revision.id],
    );
    return period.id;
  }

  const draft = (extra: object) =>
    env
      .post(
        'source-authority/versions',
        { unitId: env.world.unitA3, measurementHierarchy: null, ...extra },
        integration,
      )
      .set('Idempotency-Key', randomUUID());
  const approve = (id: string) =>
    env
      .post(`source-authority/versions/${id}/approve`, {}, checker)
      .set('Idempotency-Key', randomUUID());
  const stopPolicy = (body: object, token = manager) =>
    env
      .post('stop-event-policies', body, token)
      .set('Idempotency-Key', randomUUID());

  it('a backdated source authority draft takes effect at the requested instant on approval', async () => {
    const from = ago(30).toISOString();
    const missing = await draft({ effectiveFrom: from }).expect(422);
    expect((missing.body as ApiError).code).toBe('BACKDATE_REASON_REQUIRED');
    const future = await draft({
      effectiveFrom: new Date(Date.now() + DAY).toISOString(),
      backdateReason: 'x',
    }).expect(422);
    expect((future.body as ApiError).code).toBe('INVALID_EFFECTIVE_FROM');

    const proposed = (
      await draft({
        effectiveFrom: from,
        backdateReason: 'commissioning: meter in service since start-up',
      }).expect(201)
    ).body as VersionBody;
    expect(proposed).toMatchObject({
      state: 'proposed',
      requestedEffectiveFrom: from,
      backdateReason: 'commissioning: meter in service since start-up',
    });
    const approved = (await approve(proposed.id).expect(200))
      .body as VersionBody;
    expect(approved).toMatchObject({ state: 'approved', effectiveFrom: from });
    const audit = await env.rows<{ detail: { backdateReason: string } }>(
      `SELECT detail FROM audit_log WHERE entity_id = $1 AND action = 'source_authority.approved'`,
      [proposed.id],
    );
    expect(audit[0].detail.backdateReason).toContain('commissioning');

    // approved history is never rewritten: a later backdate must follow the version just approved
    const before = await draft({
      effectiveFrom: ago(31).toISOString(),
      backdateReason: 'earlier',
    }).expect(409);
    expect((before.body as ApiError).code).toBe('BACKDATE_REWRITES_HISTORY');
  });

  it('approval repeats the check and refuses once a calculated period overlaps the range', async () => {
    const proposed = (
      await draft({
        effectiveFrom: ago(20).toISOString(),
        backdateReason: 'commissioning correction',
      }).expect(201)
    ).body as VersionBody;
    const periodId = await calculatedPeriod(env.world.unitA3, ago(10));

    const refused = await approve(proposed.id).expect(409);
    const body = refused.body as OverlapError;
    expect(body.code).toBe('BACKDATE_OVERLAPS_CALCULATION');
    expect(body.details.periods.map((p) => p.periodId)).toEqual([periodId]);
    const [row] = await env.rows<{ approved_at: Date | null }>(
      `SELECT approved_at FROM accounting_policies WHERE id = $1`,
      [proposed.id],
    );
    expect(row.approved_at).toBeNull();

    const late = await draft({
      effectiveFrom: ago(15).toISOString(),
      backdateReason: 'again',
    }).expect(409);
    expect((late.body as ApiError).code).toBe('BACKDATE_OVERLAPS_CALCULATION');
    // after the calculated period the backdate is accepted
    await draft({
      effectiveFrom: ago(5).toISOString(),
      backdateReason: 'after the calculated period',
    }).expect(201);
  });

  it('stop-engine settings accept a backdate without calculated periods and refuse an overlap', async () => {
    const { unitA2, unitA1 } = env.world;
    const before = (
      await env.get(`stop-event-policies/current?unitId=${unitA2}`, env.admin)
    ).body as { id: string };
    const from = ago(40).toISOString();
    const written = (
      await stopPolicy(
        {
          unitId: unitA2,
          debounceSeconds: 7,
          effectiveFrom: from,
          backdateReason: 'commissioning debounce',
        },
        env.admin,
      ).expect(201)
    ).body as VersionBody & { id: string };
    expect(written).toMatchObject({
      effectiveFrom: from,
      requestedEffectiveFrom: from,
      backdateReason: 'commissioning debounce',
    });
    expect(written.id).not.toBe(before.id);

    await calculatedPeriod(unitA1, ago(3));
    const overlap = await stopPolicy(
      {
        debounceSeconds: 6,
        effectiveFrom: ago(4).toISOString(),
        backdateReason: 'plant-wide commissioning',
      },
      env.admin,
    ).expect(409);
    expect((overlap.body as ApiError).code).toBe(
      'BACKDATE_OVERLAPS_CALCULATION',
    );
    // without effectiveFrom the behaviour is unchanged: effective now
    const now = (
      await stopPolicy({ debounceSeconds: 6 }, env.admin).expect(201)
    ).body as VersionBody;
    expect(now.requestedEffectiveFrom).toBeNull();
  });
});
