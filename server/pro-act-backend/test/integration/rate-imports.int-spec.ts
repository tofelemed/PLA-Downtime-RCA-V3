import { RateImportRunner } from '../../src/profiles/rate-import.runner';
import {
  ApiError,
  ProfileBody,
  ProfileWorld,
  ratesOf,
} from './support/profile-world';

interface ImportBody {
  id: string;
  kind: string;
  externalId: string;
  revision: number;
  state: string;
  counts: {
    rows: number;
    inserted: number;
    retired: number;
    errors: number;
  } | null;
  report: Array<{ line: number; code: string; message: string }>;
}

interface StoredRate {
  rate_kind: string;
  rate: string;
  state: string;
  source: string;
  external_id: string | null;
  effective_from: Date;
}

/**
 * Plan 2.2 step 4 (PLAN06): budget / forecast / MPC imports as 202 jobs applied whole or not at all, with
 * a per-line validation report; a revision of the same document is a correction (earlier rows retired,
 * never a second active row); tenant isolation and roles.
 */
describe('rate imports (plan 2.2, v2 API)', () => {
  const env = new ProfileWorld();
  let unitCodes: Record<string, string>;
  let profileA1: ProfileBody;

  beforeAll(async () => {
    await env.start();
    profileA1 = await env.profile();
    await env.profile({ unitId: env.world.unitA2 });
    const units = await env.rows<{ id: string; code: string }>(
      `SELECT id, code FROM units`,
    );
    unitCodes = Object.fromEntries(units.map((u) => [u.id, u.code]));
  });
  afterAll(() => env.stop());

  const run = () => env.app.get(RateImportRunner).runPending();

  const forecastRow = (overrides: Record<string, unknown> = {}) => ({
    unitCode: unitCodes[env.world.unitA1],
    productCode: 'HDPE-A',
    rate: '110',
    timebase: 'h',
    effectiveFrom: '2026-11-01T00:00:00Z',
    effectiveTo: '2026-12-01T00:00:00Z',
    ...overrides,
  });

  async function importAndRun(body: object): Promise<ImportBody> {
    const accepted = await env.post('rate-imports', body).expect(202);
    const { jobId, statusUrl } = accepted.body as {
      jobId: string;
      statusUrl: string;
    };
    expect(statusUrl).toBe(`/api/v2/rate-imports/${jobId}`);
    const queued = (await env.get(`rate-imports/${jobId}`).expect(200))
      .body as ImportBody;
    expect(queued.state).toBe('queued');
    expect(await run()).toBe(1);
    return (await env.get(`rate-imports/${jobId}`).expect(200))
      .body as ImportBody;
  }

  const forecasts = () =>
    env.rows<StoredRate>(
      `SELECT rate_kind, rate::text AS rate, state, source, external_id, effective_from
         FROM unit_product_rates WHERE profile_id = $1 AND rate_kind = 'forecast' ORDER BY version`,
      [profileA1.id],
    );

  it('applies a forecast document as approved forecast versions (source import)', async () => {
    const done = await importAndRun({
      kind: 'forecast',
      externalId: 'FC-2026-11',
      fileRef: 'forecast-nov.json',
      rows: [
        forecastRow(),
        forecastRow({
          rate: '115',
          effectiveFrom: '2026-12-01T00:00:00Z',
          effectiveTo: '2027-01-01T00:00:00Z',
        }),
      ],
    });
    expect(done).toMatchObject({
      state: 'completed',
      revision: 1,
      counts: { rows: 2, inserted: 2, retired: 0, errors: 0 },
      report: [],
    });
    const rows = await forecasts();
    expect(rows.map((r) => [r.state, r.source, r.external_id])).toEqual([
      ['approved', 'import', 'FC-2026-11'],
      ['approved', 'import', 'FC-2026-11'],
    ]);
  });

  it('treats a revision of the same external id as a correction: earlier rows retired, no second active row', async () => {
    const done = await importAndRun({
      kind: 'forecast',
      externalId: 'FC-2026-11',
      rows: [forecastRow({ rate: '108.5' })],
    });
    expect(done).toMatchObject({
      state: 'completed',
      revision: 2,
      counts: { rows: 1, inserted: 1, retired: 2, errors: 0 },
    });
    const rows = await forecasts();
    expect(rows.map((r) => r.state)).toEqual([
      'retired',
      'retired',
      'approved',
    ]);
    const active = rows.filter((r) => r.state === 'approved');
    expect(active).toHaveLength(1);
    expect(Number(active[0].rate)).toBe(108.5);
    const resolved = await env
      .get(
        `profiles/resolve?unitId=${env.world.unitA1}&productId=${env.products.p1}&at=2026-11-15T00:00:00Z`,
      )
      .expect(200);
    expect(ratesOf(resolved).forecast).toMatchObject({
      rate: '108.5',
      source: 'import',
    });
    const messages = await env.rows<{ n: number }>(
      `SELECT count(*)::int AS n FROM outbox WHERE type = 'ProfileBaselineChanged' AND aggregate_type = 'rate_import'`,
    );
    expect(messages[0].n).toBe(2);
  });

  it('refuses a document with any bad row and reports every line; nothing is written', async () => {
    const before = (await forecasts()).length;
    const done = await importAndRun({
      kind: 'forecast',
      externalId: 'FC-OTHER',
      rows: [
        forecastRow({
          effectiveFrom: '2026-11-10T00:00:00Z',
          effectiveTo: '2026-11-20T00:00:00Z',
        }),
        forecastRow({ unitCode: 'no-such-unit' }),
        forecastRow({ unitCode: unitCodes[env.world.unitA3] }),
        forecastRow({ productCode: 'NOPE' }),
        forecastRow({ unitCode: unitCodes[env.world.unitB1] }),
        forecastRow({ unitCode: unitCodes[env.world.unitA2], rate: 'x' }),
      ],
    });
    expect(done.state).toBe('failed');
    expect(done.report.map((e) => [e.line, e.code])).toEqual([
      [1, 'overlaps_approved_rate'],
      [2, 'unknown_unit'],
      [3, 'no_profile'],
      [4, 'unknown_product'],
      [5, 'unknown_unit'],
      [6, 'invalid_rate'],
    ]);
    expect(done.counts).toEqual({
      rows: 6,
      inserted: 0,
      retired: 0,
      errors: 6,
    });
    expect((await forecasts()).length).toBe(before);
  });

  it('imports MPC from CSV as sustained rates', async () => {
    const csv = [
      'unitCode,productCode,operatingMode,rate,timebase,effectiveFrom,effectiveTo',
      `${unitCodes[env.world.unitA2]},HDPE-A,normal,125,h,2026-10-01T00:00:00Z,`,
    ].join('\n');
    const done = await importAndRun({
      kind: 'mpc',
      externalId: 'MPC-2026',
      csv,
    });
    expect(done).toMatchObject({ state: 'completed', counts: { inserted: 1 } });
    const resolved = await env
      .get(
        `profiles/resolve?unitId=${env.world.unitA2}&productId=${env.products.p1}&at=2026-10-09T00:00:00Z`,
      )
      .expect(200);
    expect(ratesOf(resolved).sustained).toMatchObject({
      rate: '125',
      source: 'import',
      externalId: 'MPC-2026',
    });
  });

  it('needs an approver, rows xor csv, and keeps imports inside the tenant', async () => {
    const body = { kind: 'budget', externalId: 'B-1', rows: [forecastRow()] };
    await env.post('rate-imports', body, env.analyst).expect(403);
    const both = await env
      .post('rate-imports', { ...body, csv: 'x' })
      .expect(422);
    expect((both.body as ApiError).code).toBe('INVALID_IMPORT');
    await env
      .post('rate-imports', {
        kind: 'budget',
        externalId: 'B-1',
        rows: [{ unitCode: 1 }],
      })
      .expect(422);
    const accepted = await env.post('rate-imports', body).expect(202);
    const { jobId } = accepted.body as { jobId: string };
    await env.get(`rate-imports/${jobId}`, env.adminB).expect(404);
    expect(await run()).toBe(1);
    const done = (await env.get(`rate-imports/${jobId}`).expect(200))
      .body as ImportBody;
    expect(done).toMatchObject({ state: 'completed', kind: 'budget' });
    expect(await run()).toBe(0);
  });

  it('fails a document it cannot process (internal_error) and moves on to the next', async () => {
    const [broken] = await env.rows<{ id: string }>(
      `INSERT INTO rate_imports (tenant_id, kind, external_id, revision, payload, row_version)
       VALUES ($1, 'budget', 'BROKEN', 1, '{"rows": 5}', 1) RETURNING id`,
      [env.world.tenantA],
    );
    expect(await run()).toBe(1);
    const done = (await env.get(`rate-imports/${broken.id}`).expect(200))
      .body as ImportBody;
    expect(done).toMatchObject({
      state: 'failed',
      report: [expect.objectContaining({ code: 'internal_error' })],
    });
    expect(await run()).toBe(0);
  });
});
