import { randomUUID } from 'crypto';
import { IntegrationHarness } from './harness';

const PROFILES = 'ProfilesAndRates1792275200000';

interface SeededProfile {
  tenant_id: string;
  unit_id: string;
  product_id: string;
  operating_mode: string;
  quantity_uom: string | null;
  state: string;
  version: number;
  effective_from: Date;
  rate_timebase: string | null;
  legacy_values: Record<string, string | null>;
}

/**
 * Plan 2.2 steps 1 and 3: the `ProfilesAndRates` migration seeds one draft profile per (unit, product)
 * of the v1 plans of one tenant (first plan start, quantity unit from the product or else the unit),
 * keeps v1 capacity / ideal cycle time / `standard_rate` as review values only (no rate, no timebase
 * guessed; `standard_rate` flagged as an unconfirmed legacy cost, D08), and the exclusion constraints
 * refuse overlapping approved versions even when written directly.
 */
describe('ProfilesAndRates migration: legacy seed and no-overlap constraints', () => {
  const harness = new IntegrationHarness();
  const org = randomUUID();
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const unitA = randomUUID();
  const unitNoUom = randomUUID();
  const unitB = randomUUID();
  const productA = randomUUID();
  const productNoUom = randomUUID();
  const productB = randomUUID();

  beforeAll(async () => {
    await harness.start();
    while (await executed(PROFILES)) {
      await harness.dataSource.undoLastMigration({ transaction: 'all' });
    }
    const q = (sql: string, params: unknown[]) =>
      harness.dataSource.query(sql, params);
    await q(
      `INSERT INTO organizations (id, code, name, is_active) VALUES ($1, $2, 'Org', true)`,
      [org, `ORG-${org.slice(0, 8)}`],
    );
    for (const [id, code] of [
      [tenantA, 'A'],
      [tenantB, 'B'],
    ]) {
      await q(
        `INSERT INTO tenants (id, code, name, organization_id, is_active) VALUES ($1, $2, $2, $3, true)`,
        [id, `T-${code}-${org.slice(0, 6)}`, org],
      );
    }
    await q(
      `INSERT INTO units (id, code, name, tenant_id, capacity, unit_of_measure, ideal_cycle_time)
       VALUES ($1, 'u-a', 'u-a', $2, 125.5, 'kg', 2.5), ($3, 'u-n', 'u-n', $2, NULL, NULL, NULL),
              ($4, 'u-b', 'u-b', $5, 10, 't', NULL)`,
      [unitA, tenantA, unitNoUom, unitB, tenantB],
    );
    await q(
      `INSERT INTO products (id, name, code, tenant_id, uom, standard_rate)
       VALUES ($1, 'p-a', 'p-a', $2, 't', 42.25), ($3, 'p-n', 'p-n', $2, NULL, NULL), ($4, 'p-b', 'p-b', $5, 't', 1)`,
      [productA, tenantA, productNoUom, productB, tenantB],
    );
    const plan = (
      unit: string,
      product: string | null,
      tenant: string | null,
      start: string,
    ) =>
      q(
        `INSERT INTO production_plans (plan_name, unit_id, product_id, tenant_id, start_date, end_date)
         VALUES ('plan', $1, $2, $3, $4, $4::timestamptz + interval '8 hours')`,
        [unit, product, tenant, start],
      );
    await plan(unitA, productA, tenantA, '2026-03-01T06:00:00Z');
    await plan(unitA, productA, null, '2026-02-01T06:00:00Z');
    await plan(
      unitA.toUpperCase(),
      productNoUom,
      tenantA,
      '2026-04-01T06:00:00Z',
    );
    await plan(unitNoUom, productNoUom, tenantA, '2026-05-01T06:00:00Z');
    await plan(unitA, productB, tenantA, '2026-01-01T06:00:00Z'); // product of another tenant
    await plan(unitB, productB, tenantA, '2026-01-01T06:00:00Z'); // plan tenant differs from unit tenant
    await plan('not-a-uuid', productA, tenantA, '2026-01-01T06:00:00Z');
    await plan(unitA, null, tenantA, '2026-01-01T06:00:00Z');
    await harness.runMigrations();
  });

  afterAll(() => harness.stop());

  async function executed(name: string): Promise<boolean> {
    const rows = await harness.dataSource.query<Array<{ n: number }>>(
      `SELECT count(*)::int AS n FROM migrations WHERE name = $1`,
      [name],
    );
    return rows[0].n > 0;
  }

  const seeded = () =>
    harness.dataSource.query<SeededProfile[]>(
      `SELECT * FROM production_profiles ORDER BY effective_from`,
    );

  it('seeds one draft profile per same-tenant (unit, product) of the v1 plans, from its first plan', async () => {
    const rows = await seeded();
    expect(
      rows.map((r) => [
        r.unit_id,
        r.product_id,
        r.quantity_uom,
        r.state,
        r.version,
        r.operating_mode,
      ]),
    ).toEqual([
      [unitA, productA, 't', 'draft', 1, 'normal'],
      [unitA, productNoUom, 'kg', 'draft', 1, 'normal'],
      [unitNoUom, productNoUom, null, 'draft', 1, 'normal'],
    ]);
    expect(rows[0].effective_from.toISOString()).toBe(
      '2026-02-01T06:00:00.000Z',
    );
    expect(
      rows.every((r) => r.tenant_id === tenantA && r.rate_timebase === null),
    ).toBe(true);
  });

  it('keeps v1 values for review only: no rate rows, standard_rate flagged as unconfirmed legacy cost', async () => {
    const [first] = await seeded();
    expect(first.legacy_values).toEqual({
      capacity: '125.5000',
      capacityUom: 'kg',
      idealCycleTime: '2.50',
      standardRate: '42.2500',
      standardRateStatus: 'unconfirmed_legacy_cost',
    });
    const rates = await harness.dataSource.query<Array<{ n: number }>>(
      `SELECT count(*)::int AS n FROM unit_product_rates`,
    );
    expect(rates[0].n).toBe(0);
  });

  it('refuses overlapping approved versions in the database itself (exclusion constraints)', async () => {
    const [profile] = await seeded();
    const id = (
      await harness.dataSource.query<Array<{ id: string }>>(
        `SELECT id FROM production_profiles WHERE unit_id = $1 AND product_id = $2`,
        [unitA, productA],
      )
    )[0].id;
    expect(profile.unit_id).toBe(unitA);
    const insertRate = (
      version: number,
      from: string,
      to: string | null,
      state = 'approved',
    ) =>
      harness.dataSource.query(
        `INSERT INTO unit_product_rates (tenant_id, profile_id, rate_kind, rate, timebase, effective_from,
           effective_to, version, state, approved_at, row_version)
         VALUES ($1, $2, 'sustained', 100, 'h', $3, $4, $5, $6::unit_product_rate_state, now(), 1)`,
        [tenantA, id, from, to, version, state],
      );
    await insertRate(1, '2026-10-01T00:00:00Z', '2026-10-09T10:30:00Z');
    await insertRate(2, '2026-10-09T10:30:00Z', null); // touching at the boundary: half-open, allowed
    await expect(
      insertRate(3, '2026-10-09T10:00:00Z', null),
    ).rejects.toMatchObject({ code: '23P01' });
    await insertRate(4, '2026-10-09T10:00:00Z', null, 'draft'); // drafts may overlap
    await expect(
      harness.dataSource.query(
        `INSERT INTO valuation_rates (tenant_id, profile_id, impact_code_id, basis, value, currency, per_uom,
           effective_from, version, row_version) VALUES ($1, NULL, NULL, 'standard_cost', 1, 'IRR', 't', now(), 1, 1)`,
        [tenantA],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });
});
