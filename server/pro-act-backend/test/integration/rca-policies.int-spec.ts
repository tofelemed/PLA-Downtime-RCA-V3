import { randomUUID } from 'crypto';
import { ActualsWorld } from './support/actuals-world';

interface PolicyBody {
  id: string;
  unitId: string | null;
  version: number;
  durationThresholdSeconds: number;
  costThreshold: number | null;
  repeatCount: number;
  repeatWindowDays: number;
  autoCreate: string;
  effectiveTo: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
}

/**
 * `rca_policy` over `/v2/rca-policies` (plan 3.9, D13) on real Postgres: the D13 default seeded on first
 * read, new approved versions closing the previous one, the unit override, roles and scope. Test data only.
 */
describe('RCA trigger policy API (plan 3.9)', () => {
  const env = new ActualsWorld();
  let unitManager = '';

  const change = {
    durationThresholdSeconds: 1800,
    repeatCount: 2,
    repeatWindowDays: 14,
    autoCreate: 'create',
    costThreshold: 5000,
    notes: 'tighter after audit',
  };
  const current = async (query = '', token = env.admin) =>
    (await env.get(`rca-policies/current${query}`, token).expect(200))
      .body as PolicyBody;

  beforeAll(async () => {
    await env.start();
    unitManager = await env.unitUser(env.world.unitA1);
  });
  afterAll(() => env.stop());

  it('current seeds the D13 default as version 1', async () => {
    expect(await current('', env.analyst)).toMatchObject({
      unitId: null,
      version: 1,
      durationThresholdSeconds: 3600,
      repeatCount: 3,
      repeatWindowDays: 30,
      autoCreate: 'recommend',
      costThreshold: null,
      effectiveTo: null,
    });
  });

  it('a manager records version 2; current returns it and version 1 is closed', async () => {
    const created = (await env.post('rca-policies', change).expect(201))
      .body as PolicyBody;
    expect(created).toMatchObject({
      version: 2,
      unitId: null,
      durationThresholdSeconds: 1800,
      costThreshold: 5000,
      autoCreate: 'create',
    });
    expect(created.approvedBy).not.toBeNull();
    expect(created.approvedAt).not.toBeNull();
    expect(await current()).toMatchObject({ id: created.id, version: 2 });
    const list = (await env.get('rca-policies').expect(200)).body as {
      items: PolicyBody[];
    };
    expect(list.items.map((p) => p.version)).toEqual([2, 1]);
    expect(list.items[1].effectiveTo).not.toBeNull();
  });

  it('pages newest version first with a cursor', async () => {
    const first = (await env.get('rca-policies?limit=1').expect(200)).body as {
      items: PolicyBody[];
      nextCursor: string;
    };
    expect(first.items.map((p) => p.version)).toEqual([2]);
    const second = (
      await env
        .get(`rca-policies?limit=1&cursor=${first.nextCursor}`)
        .expect(200)
    ).body as { items: PolicyBody[]; nextCursor: string | null };
    expect(second.items.map((p) => p.version)).toEqual([1]);
    expect(second.nextCursor).toBeNull();
  });

  it('403 for a non-manager and for a unit-limited manager on the tenant-wide policy', async () => {
    await env.post('rca-policies', change, env.analyst).expect(403);
    const limited = await env
      .post('rca-policies', change, unitManager)
      .expect(403);
    expect((limited.body as { code: string }).code).toBe(
      'TENANT_SCOPE_REQUIRED',
    );
  });

  it('a unit override wins for that unit only', async () => {
    const unit = env.world.unitA1;
    const override = (
      await env
        .post(
          'rca-policies',
          { ...change, unitId: unit, durationThresholdSeconds: 600 },
          unitManager,
        )
        .expect(201)
    ).body as PolicyBody;
    expect(override).toMatchObject({ unitId: unit, version: 1 });
    expect(await current(`?unitId=${unit}`)).toMatchObject({
      id: override.id,
      durationThresholdSeconds: 600,
    });
    expect(await current(`?unitId=${env.world.unitA2}`)).toMatchObject({
      unitId: null,
      version: 2,
    });
    const units = (await env.get(`rca-policies?unitId=${unit}`).expect(200))
      .body as { items: PolicyBody[] };
    expect(units.items.map((p) => p.id)).toEqual([override.id]);
  });

  it('422 for a unit of another tenant or outside the caller scope, and for an invalid body', async () => {
    const foreign = await env
      .get(`rca-policies/current?unitId=${env.world.unitB1}`)
      .expect(422);
    expect((foreign.body as { code: string }).code).toBe('INVALID_REFERENCE');
    await env
      .post(
        'rca-policies',
        { ...change, unitId: env.world.unitA2 },
        unitManager,
      )
      .expect(422);
    await env
      .post('rca-policies', { ...change, unitId: randomUUID() })
      .expect(422);
    await env
      .post('rca-policies', { ...change, repeatWindowDays: 400 })
      .expect(422);
    await env.post('rca-policies', { ...change, extra: true }).expect(422);
  });
});
