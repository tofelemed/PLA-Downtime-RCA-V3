import { randomUUID } from 'crypto';
import { IntegrationHarness } from './harness';

const PERIODS_ACTUALS = 'PeriodsActuals1792448000000';
const TABLES = [
  'accounting_policies',
  'production_periods',
  'period_product_slices',
  'actuals_runs',
  'actuals_results',
  'actuals_adjustments',
  'external_production_reports',
  'actuals_jobs',
];

/**
 * Plan 2.4 step 1: the `PeriodsActuals` migration creates the period / actuals tables, the immutability
 * triggers and the `production_losses_v` view, seeds the D05 `coverage_gate` and `source_authority`
 * defaults (version 1, tenant-wide) for every existing tenant, and `down()` removes all of it.
 */
describe('PeriodsActuals migration', () => {
  const harness = new IntegrationHarness();
  const org = randomUUID();
  const tenants = [randomUUID(), randomUUID()];
  const q = <T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ) => harness.dataSource.query<T[]>(sql, params);
  const executed = async (name: string) =>
    (await q(`SELECT 1 FROM migrations WHERE name = $1`, [name])).length > 0;
  const present = async (name: string) =>
    (
      await q<{ found: string | null }>(
        `SELECT to_regclass($1)::text AS found`,
        [`public.${name}`],
      )
    )[0].found !== null;

  beforeAll(async () => {
    await harness.start();
    while (await executed(PERIODS_ACTUALS)) {
      await harness.dataSource.undoLastMigration({ transaction: 'all' });
    }
    await q(
      `INSERT INTO organizations (id, code, name, is_active) VALUES ($1, $2, 'Org', true)`,
      [org, `ORG-${org.slice(0, 8)}`],
    );
    for (const [index, id] of tenants.entries()) {
      await q(
        `INSERT INTO tenants (id, code, name, organization_id, is_active) VALUES ($1, $2, $2, $3, true)`,
        [id, `T-${index}-${org.slice(0, 6)}`, org],
      );
    }
  });
  afterAll(() => harness.stop());

  it('before: none of the plan 2.4 objects exist', async () => {
    for (const table of [...TABLES, 'production_losses_v'])
      expect(await present(table)).toBe(false);
  });

  it('up: creates the tables and view and seeds the D05 defaults per tenant', async () => {
    await harness.runMigrations();
    for (const table of [...TABLES, 'production_losses_v'])
      expect(await present(table)).toBe(true);
    const policies = await q<{
      tenant_id: string;
      policy_kind: string;
      version: number;
      body: Record<string, unknown>;
    }>(
      `SELECT tenant_id, policy_kind, version, body FROM accounting_policies WHERE unit_id IS NULL ORDER BY policy_kind`,
    );
    for (const tenant of tenants) {
      const own = policies.filter((p) => p.tenant_id === tenant);
      expect(own.map((p) => [p.policy_kind, p.version])).toEqual([
        ['coverage_gate', 1],
        ['source_authority', 1],
      ]);
      expect(own[1].body).toMatchObject({
        primarySource: 'pi_output_ef',
        fallback: { source: 'pi_counter' },
      });
    }
    expect(await harness.pendingSchemaChanges()).toEqual([]);
  });

  it('down: removes everything; up again restores it', async () => {
    await harness.dataSource.undoLastMigration({ transaction: 'all' });
    for (const table of [...TABLES, 'production_losses_v'])
      expect(await present(table)).toBe(false);
    const functions = await q(
      `SELECT 1 FROM pg_proc WHERE proname = 'actuals_immutable'`,
    );
    expect(functions).toEqual([]);
    await harness.runMigrations();
    expect(await present('production_periods')).toBe(true);
  });
});
