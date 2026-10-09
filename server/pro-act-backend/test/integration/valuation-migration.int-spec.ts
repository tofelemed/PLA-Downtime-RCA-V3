import { IntegrationHarness } from './harness';
import { seedEventWorld } from './support/seed-event-world';

const VALUATION = 'Valuation1792880000000';
const TABLES = ['fx_rates', 'loss_line_valuations', 'period_valuation_totals'];

interface PolicyRow {
  tenant_id: string;
  version: number;
  approved_at: Date | null;
  body: Record<string, unknown>;
}

/**
 * Migration `Valuation` (plan 2.6 step 1): the FX rate table, the per-run valuation tables with their
 * immutability triggers, `calculation_runs.valuation_context`, and the `valuation_basis` policy kind seeded
 * per existing tenant as version 1 (the XXX placeholder, kept as history) and version 2 (IRR and USD, D08),
 * both unapproved; `down()` removes all of it and up re-applies; the schema matches the entities.
 */
describe('Valuation migration', () => {
  const harness = new IntegrationHarness();
  const q = <T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ) => harness.dataSource.query<T[]>(sql, params);
  const executed = async () =>
    (await q(`SELECT 1 FROM migrations WHERE name = $1`, [VALUATION])).length >
    0;
  const present = async (name: string) =>
    (
      await q<{ found: string | null }>(
        `SELECT to_regclass($1)::text AS found`,
        [`public.${name}`],
      )
    )[0].found !== null;
  const triggers = async () =>
    (
      await q(
        `SELECT 1 FROM pg_trigger WHERE tgname IN ('trg_loss_line_valuations_immutable', 'trg_period_valuation_totals_immutable')`,
      )
    ).length;
  const policies = () =>
    q<PolicyRow>(
      `SELECT tenant_id, version, approved_at, body FROM accounting_policies
        WHERE policy_kind::text = 'valuation_basis' ORDER BY tenant_id, version`,
    );

  beforeAll(async () => {
    await harness.start();
  });
  afterAll(() => harness.stop());

  it('up: tables, triggers and run column exist; the schema matches the entities', async () => {
    expect(await executed()).toBe(true);
    for (const table of TABLES) expect(await present(table)).toBe(true);
    expect(await triggers()).toBe(2);
    expect(await harness.pendingSchemaChanges()).toEqual([]);
  });

  it('seeds every existing tenant with v1 (XXX history) and v2 (IRR, USD), both unapproved; down removes everything', async () => {
    const world = await seedEventWorld(harness.dataSource);
    while (await executed()) {
      await harness.dataSource.undoLastMigration({ transaction: 'all' });
    }
    for (const table of TABLES) expect(await present(table)).toBe(false);
    expect(await triggers()).toBe(0);
    await harness.runMigrations();
    expect(await executed()).toBe(true);
    const rows = (await policies()).filter(
      (r) => r.tenant_id === world.tenantA,
    );
    expect(rows.map((r) => [r.version, r.approved_at])).toEqual([
      [1, null],
      [2, null],
    ]);
    expect(rows[0].body).toMatchObject({ currency: 'XXX', fxPolicy: 'none' });
    expect(rows[1].body).toMatchObject({
      reportingCurrencies: ['IRR', 'USD'],
      fxPolicy: 'snapshot',
    });
    expect(
      (await policies()).filter((r) => r.tenant_id === world.tenantB),
    ).toHaveLength(2);
    expect(await harness.pendingSchemaChanges()).toEqual([]);
  });
});
