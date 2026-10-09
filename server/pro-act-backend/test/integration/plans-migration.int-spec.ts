import { randomUUID } from 'crypto';
import { IntegrationHarness } from './harness';

const PLAN_VERSIONS = 'PlanVersions1792361600000';

interface MigratedPlan {
  plan_name: string;
  legacy_id: string | null;
  scenario_id: string | null;
  current_version: number | null;
  unit_ref_id: string | null;
  product_ref_id: string | null;
}

/**
 * Plan 2.3 step 1: the `PlanVersions` migration gives every tenant a baseline scenario, keeps `legacy_id`,
 * links v1 plans to their unit and product by uuid when they resolve in the plan's tenant, and creates
 * draft version 1 per resolvable plan (target → quantity basis by scheduled capacity, none → time basis)
 * with one sequential slice when the product resolves; unresolvable plans keep working without versions.
 */
describe('PlanVersions migration: scenarios and draft version 1 per legacy plan', () => {
  const harness = new IntegrationHarness();
  const org = randomUUID();
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const unitA = randomUUID();
  const unitB = randomUUID();
  const productA = randomUUID();
  const productB = randomUUID();
  const q = (sql: string, params: unknown[] = []) =>
    harness.dataSource.query(sql, params);

  beforeAll(async () => {
    await harness.start();
    while (await executed(PLAN_VERSIONS)) {
      await harness.dataSource.undoLastMigration({ transaction: 'all' });
    }
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
      `INSERT INTO units (id, code, name, tenant_id) VALUES ($1, 'u-a', 'u-a', $2), ($3, 'u-b', 'u-b', $4)`,
      [unitA, tenantA, unitB, tenantB],
    );
    await q(
      `INSERT INTO products (id, name, code, tenant_id, uom) VALUES ($1, 'p-a', $3, $2, 't'), ($4, 'p-b', $6, $5, 't')`,
      [
        productA,
        tenantA,
        `p-a-${org.slice(0, 6)}`,
        productB,
        tenantB,
        `p-b-${org.slice(0, 6)}`,
      ],
    );
    const plan = (
      name: string,
      unit: string,
      product: string | null,
      target: number | null,
      hours = 24,
    ) =>
      q(
        `INSERT INTO production_plans (plan_name, unit_id, product_id, tenant_id, start_date, end_date, target_quantity)
         VALUES ($1, $2, $3, $4, '2026-03-01T02:30:00Z', '2026-03-01T02:30:00Z'::timestamptz + make_interval(hours => $5), $6)`,
        [name, unit, product, tenantA, hours, target],
      );
    await plan('quantity', unitA.toUpperCase(), productA, 1000);
    await plan('time', unitA, productA, null);
    await plan('no product', unitA, null, 50);
    await plan('foreign product', unitA, productB, 10);
    await plan('foreign unit', unitB, productB, 10);
    await plan('not a uuid', 'unit-100', productA, 10);
    await plan('empty window', unitA, productA, 10, 0);
    await harness.runMigrations();
  });

  afterAll(() => harness.stop());

  async function executed(name: string): Promise<boolean> {
    const rows = await q(
      `SELECT count(*)::int AS n FROM migrations WHERE name = $1`,
      [name],
    );
    return (rows as Array<{ n: number }>)[0].n > 0;
  }

  const plans = async (): Promise<Record<string, MigratedPlan>> => {
    const rows = (await q(
      `SELECT plan_name, legacy_id, scenario_id, current_version, unit_ref_id, product_ref_id, id FROM production_plans`,
    )) as Array<MigratedPlan & { id: string }>;
    expect(rows.every((row) => row.legacy_id === row.id)).toBe(true);
    return Object.fromEntries(rows.map((row) => [row.plan_name, row]));
  };

  it('creates one accounting-baseline scenario per tenant', async () => {
    const rows = (await q(
      `SELECT tenant_id, name, is_accounting_baseline FROM plan_scenarios ORDER BY name`,
    )) as Array<{ tenant_id: string; is_accounting_baseline: boolean }>;
    const tenants: string[] = [tenantA, tenantB];
    const ours = rows.filter((row) => tenants.includes(row.tenant_id));
    expect(ours).toHaveLength(2);
    expect(ours.every((row) => row.is_accounting_baseline)).toBe(true);
  });

  it('links resolvable plans by uuid and leaves the others without versions', async () => {
    const byName = await plans();
    expect(byName.quantity).toMatchObject({
      unit_ref_id: unitA,
      product_ref_id: productA,
      current_version: 1,
    });
    expect(byName['foreign product']).toMatchObject({
      unit_ref_id: unitA,
      product_ref_id: null,
      current_version: 1,
    });
    for (const name of ['foreign unit', 'not a uuid']) {
      expect(byName[name]).toMatchObject({
        unit_ref_id: null,
        scenario_id: null,
        current_version: null,
      });
    }
    expect(byName['empty window']).toMatchObject({
      unit_ref_id: unitA,
      current_version: null,
    });
  });

  it('creates draft version 1 with the v1 target as a quantity basis and one slice per resolved product', async () => {
    const rows = (await q(
      `SELECT p.plan_name, v.version, v.approval_state, v.basis, v.header_target::text AS target, v.distribution,
              v.tenant_id, (SELECT count(*)::int FROM plan_product_slices s WHERE s.plan_version_id = v.id) AS slices
         FROM plan_versions v JOIN production_plans p ON p.id = v.plan_id ORDER BY p.plan_name`,
    )) as Array<Record<string, unknown>>;
    expect(
      rows.map((r) => [
        r.plan_name,
        r.version,
        r.approval_state,
        r.basis,
        r.target,
        r.slices,
      ]),
    ).toEqual([
      ['foreign product', 1, 'draft', 'quantity', '10.00000000', 0],
      ['no product', 1, 'draft', 'quantity', '50.00000000', 0],
      ['quantity', 1, 'draft', 'quantity', '1000.00000000', 1],
      ['time', 1, 'draft', 'time', null, 1],
    ]);
    expect(
      rows.every(
        (r) =>
          r.tenant_id === tenantA && r.distribution === 'scheduled_capacity',
      ),
    ).toBe(true);
    expect(await q(`SELECT 1 FROM plan_periods`)).toEqual([]);
  });

  it('reverts cleanly and re-applies', async () => {
    await harness.dataSource.undoLastMigration({ transaction: 'all' });
    expect(await executed(PLAN_VERSIONS)).toBe(false);
    await harness.runMigrations();
    expect(await executed(PLAN_VERSIONS)).toBe(true);
    expect(await harness.pendingSchemaChanges()).toEqual([]);
  });
});
