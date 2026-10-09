import { randomUUID } from 'crypto';
import { IntegrationHarness } from './harness';

const ACCOUNTING_ENGINE = 'AccountingEngine1792534400000';
const TABLES = [
  'accounting_revisions',
  'calculation_runs',
  'loss_lines',
  'loss_line_evidence',
  'period_ledger_totals',
];

/**
 * Migration `AccountingEngine` (plan 2.5 step 1): creates the run container, lines, evidence and totals,
 * the immutability trigger, the `oee_policy` / `reconciliation_tolerance` kinds seeded with the D04 / D06
 * defaults per tenant and the v1 compatibility views; `down()` removes all of it and restores the 2.4
 * `production_losses_v`.
 */
describe('AccountingEngine migration', () => {
  const harness = new IntegrationHarness();
  const org = randomUUID();
  const tenant = randomUUID();
  const q = <T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ) => harness.dataSource.query<T[]>(sql, params);
  const executed = async () =>
    (await q(`SELECT 1 FROM migrations WHERE name = $1`, [ACCOUNTING_ENGINE]))
      .length > 0;
  const present = async (name: string) =>
    (
      await q<{ found: string | null }>(
        `SELECT to_regclass($1)::text AS found`,
        [`public.${name}`],
      )
    )[0].found !== null;
  const viewColumns = async (view: string) =>
    (
      await q<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
        [view],
      )
    ).map((c) => c.column_name);

  beforeAll(async () => {
    await harness.start();
    while (await executed()) {
      await harness.dataSource.undoLastMigration({ transaction: 'all' });
    }
    await q(
      `INSERT INTO organizations (id, code, name, is_active) VALUES ($1, $2, 'Org', true)`,
      [org, `ORG-${org.slice(0, 8)}`],
    );
    await q(
      `INSERT INTO tenants (id, code, name, organization_id, is_active) VALUES ($1, $2, $2, $3, true)`,
      [tenant, `T-${tenant.slice(0, 8)}`, org],
    );
  });
  afterAll(() => harness.stop());

  it('before: no plan 2.5 objects; the 2.4 view has no ledger columns', async () => {
    for (const table of [...TABLES, 'loss_categories_v'])
      expect(await present(table)).toBe(false);
    expect(await viewColumns('production_losses_v')).not.toContain('losses');
  });

  it('up: tables, views, immutability and the D04 / D06 policy defaults per tenant', async () => {
    await harness.runMigrations();
    for (const table of [...TABLES, 'loss_categories_v'])
      expect(await present(table)).toBe(true);
    expect(await viewColumns('production_losses_v')).toEqual(
      expect.arrayContaining([
        'actual',
        'short_range_plan',
        'losses',
        'unaccounted_loss',
        'calculation_run_id',
      ]),
    );
    const policies = await q<{
      policy_kind: string;
      body: Record<string, unknown>;
    }>(
      `SELECT policy_kind, body FROM accounting_policies
        WHERE tenant_id = $1 AND policy_kind IN ('oee_policy', 'reconciliation_tolerance') ORDER BY policy_kind`,
      [tenant],
    );
    expect(policies.map((p) => p.policy_kind)).toEqual([
      'oee_policy',
      'reconciliation_tolerance',
    ]);
    expect(policies[0].body).toMatchObject({
      derateComponent: 'performance',
      microStopSeconds: 60,
      defaultLedgerView: 'plan',
    });
    expect(policies[1].body).toMatchObject({
      mode: 'zero',
      epsilon: 0.000001,
      allowUnaccountedClassification: false,
    });
    const triggers = await q(
      `SELECT tgname FROM pg_trigger WHERE tgname IN ('trg_loss_lines_immutable', 'trg_loss_line_evidence_immutable', 'trg_period_ledger_totals_immutable')`,
    );
    expect(triggers).toHaveLength(3);
    expect(await harness.pendingSchemaChanges()).toEqual([]);
  });

  it('down: removes everything and restores the 2.4 view; up again re-applies', async () => {
    // later migrations (ReconciliationWorkflow, …) are undone first
    while (await executed()) {
      await harness.dataSource.undoLastMigration({ transaction: 'all' });
    }
    for (const table of [...TABLES, 'loss_categories_v'])
      expect(await present(table)).toBe(false);
    expect(await present('production_losses_v')).toBe(true);
    expect(await viewColumns('production_losses_v')).not.toContain('losses');
    expect(
      await q(
        `SELECT 1 FROM pg_proc WHERE proname = 'accounting_lines_immutable'`,
      ),
    ).toEqual([]);
    expect(
      await q(
        `SELECT 1 FROM accounting_policies WHERE policy_kind::text IN ('oee_policy', 'reconciliation_tolerance')`,
      ),
    ).toEqual([]);
    await harness.runMigrations();
    expect(await executed()).toBe(true);
    expect(await harness.pendingSchemaChanges()).toEqual([]);
  });
});
