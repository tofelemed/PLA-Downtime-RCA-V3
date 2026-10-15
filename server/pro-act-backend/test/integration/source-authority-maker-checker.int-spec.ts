import { randomUUID } from 'crypto';
import { ActualsWorld } from './support/actuals-world';
import { ApiError } from './support/plan-world';
import { signToken } from './support/test-app';

interface VersionBody {
  id: string;
  version: number;
  state: string;
  inForce: boolean;
  basedOnId: string | null;
  effectiveTo: string | null;
  rejectionReason: string | null;
  policy: { primarySource: string; measurementHierarchy?: object };
}

interface InForceBody {
  policyId: string;
  version: number;
}

/**
 * Owner, 15 Oct 2026: source authority versions are maker-checker master data on real Postgres. A draft
 * by the integration owner resolves nowhere; production accounting approves it (never the author, never
 * the integration owner), it comes into force and ends the previous version of the unit; a draft prepared
 * from a replaced version is refused as stale; a rejection keeps the version in force.
 */
describe('source authority maker-checker (owner, 15 Oct 2026)', () => {
  const env = new ActualsWorld();
  let integration = '';
  let accountant = '';
  let checker = '';

  beforeAll(async () => {
    await env.start();
    const { unitA3 } = env.world;
    integration = await env.unitUser(unitA3, 'integration_admin');
    accountant = await env.unitUser(unitA3, 'production_accountant');
    checker = await env.unitUser(unitA3, 'production_accountant');
  });
  afterAll(() => env.stop());

  const hierarchy = (key: string) => ({
    unitId: env.world.unitA3,
    measurementHierarchy: {
      boundary: 'reactor_outlet',
      conditions: ['primary_missing'],
      entries: [
        {
          rank: 1,
          sourceClass: 'calibrated_primary',
          source: 'pi_counter',
          signalSourceKey: key,
          boundary: 'reactor_outlet',
        },
      ],
    },
  });
  const draft = async (token: string, key = 'FT-101.TOT') =>
    (
      await env
        .post('source-authority/versions', hierarchy(key), token)
        .set('Idempotency-Key', randomUUID())
        .expect(201)
    ).body as VersionBody;
  const decide = (id: string, action: string, token: string, body = {}) =>
    env
      .post(`source-authority/versions/${id}/${action}`, body, token)
      .set('Idempotency-Key', randomUUID());
  const inForce = async () =>
    (
      await env
        .get(`source-authority?unitId=${env.world.unitA3}`, accountant)
        .expect(200)
    ).body as InForceBody;

  it('a draft is not in force; only production accounting other than the author approves it', async () => {
    const before = await inForce();
    const proposed = await draft(integration);
    expect(proposed).toMatchObject({
      state: 'proposed',
      inForce: false,
      basedOnId: before.policyId,
    });
    expect((await inForce()).policyId).toBe(before.policyId);

    const role = await decide(proposed.id, 'approve', integration).expect(403);
    expect((role.body as ApiError).code).toBe('FORBIDDEN_ROLE');
    const own = await draft(accountant, 'FT-109.TOT');
    const sod = await decide(own.id, 'approve', accountant).expect(403);
    expect((sod.body as ApiError).code).toBe('SEPARATION_OF_DUTIES');

    const approved = (
      await decide(proposed.id, 'approve', checker, {
        reason: 'checked',
      }).expect(200)
    ).body as VersionBody;
    expect(approved).toMatchObject({ state: 'approved', inForce: true });
    expect((await inForce()).policyId).toBe(proposed.id);
    // a unit version leaves the tenant-wide version it was prepared from untouched
    const tenantWide = await env.rows<{ effective_to: Date | null }>(
      `SELECT effective_to FROM accounting_policies WHERE id = $1`,
      [before.policyId],
    );
    expect(tenantWide[0].effective_to).toBeNull();
    const audit = await env.rows<{ n: number }>(
      `SELECT count(*)::int AS n FROM audit_log WHERE entity_id = $1 AND action = 'source_authority.approved'`,
      [proposed.id],
    );
    expect(audit[0].n).toBe(1);

    const again = await decide(proposed.id, 'approve', checker).expect(409);
    expect((again.body as ApiError).code).toBe('INVALID_TRANSITION');
    const stale = await decide(own.id, 'approve', checker).expect(409);
    expect((stale.body as ApiError).code).toBe('STALE_DRAFT');
  });

  it('a rejection records the reason and keeps the version in force', async () => {
    const before = await inForce();
    const proposed = await draft(integration, 'FT-110.TOT');
    const invalid = await decide(proposed.id, 'reject', checker).expect(422);
    expect((invalid.body as ApiError).code).toBe('VALIDATION_FAILED');
    const rejected = (
      await decide(proposed.id, 'reject', checker, {
        reason: 'wrong totalizer tag',
      }).expect(200)
    ).body as VersionBody;
    expect(rejected).toMatchObject({
      state: 'rejected',
      inForce: false,
      rejectionReason: 'wrong totalizer tag',
    });
    expect((await inForce()).policyId).toBe(before.policyId);
    const late = await decide(proposed.id, 'approve', checker).expect(409);
    expect((late.body as ApiError).code).toBe('INVALID_TRANSITION');

    const pending = (
      await env
        .get(
          `source-authority/versions?unitId=${env.world.unitA3}&state=rejected`,
          accountant,
        )
        .expect(200)
    ).body as { items: VersionBody[] };
    expect(pending.items.map((item) => item.id)).toEqual([proposed.id]);
    await env
      .get(`source-authority/versions/${proposed.id}`, env.adminB)
      .expect(404);
  });

  it('the next approved version of the unit ends the one before it', async () => {
    const previous = await inForce();
    const next = await draft(integration, 'FT-111.TOT');
    expect(next.basedOnId).toBe(previous.policyId);
    await decide(next.id, 'approve', checker).expect(200);
    const ended = (
      await env
        .get(`source-authority/versions/${previous.policyId}`, accountant)
        .expect(200)
    ).body as VersionBody;
    expect(ended.inForce).toBe(false);
    expect(ended.effectiveTo).not.toBeNull();
    expect((await inForce()).policyId).toBe(next.id);
  });

  it('a plant-wide draft is listed with the unit and approved by plant-wide production accounting', async () => {
    const plantWide = (role: string) =>
      signToken(env.app, {
        userId: randomUUID(),
        tenantId: env.world.tenantA,
        role,
      });
    const author = plantWide('integration_admin');
    const approver = plantWide('production_accountant');
    const body = { ...hierarchy('FT-200.TOT'), unitId: undefined };
    const unitOnly = await env
      .post('source-authority/versions', body, integration)
      .set('Idempotency-Key', randomUUID())
      .expect(403);
    expect((unitOnly.body as ApiError).code).toBe('TENANT_SCOPE_REQUIRED');
    const proposed = (
      await env
        .post('source-authority/versions', body, author)
        .set('Idempotency-Key', randomUUID())
        .expect(201)
    ).body as VersionBody & { unitId: string | null };
    expect(proposed.unitId).toBeNull();
    const listed = (
      await env
        .get(
          `source-authority/versions?unitId=${env.world.unitA3}&includeTenantWide=true&state=proposed`,
          approver,
        )
        .expect(200)
    ).body as { items: Array<VersionBody & { unitId: string | null }> };
    expect(listed.items.map((item) => item.id)).toContain(proposed.id);
    const unitList = (
      await env
        .get(`source-authority/versions?unitId=${env.world.unitA3}`, approver)
        .expect(200)
    ).body as { items: VersionBody[] };
    expect(unitList.items.map((item) => item.id)).not.toContain(proposed.id);
    await decide(proposed.id, 'approve', approver).expect(200);
  });
});
