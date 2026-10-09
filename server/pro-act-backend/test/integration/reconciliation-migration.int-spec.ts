import { IntegrationHarness } from './harness';

const WORKFLOW = 'ReconciliationWorkflow1792620800000';
const TABLES = [
  'reconciliation_line_sets',
  'reconciliation_lines',
  'approval_actions',
  'approval_snapshots',
  'period_change_proposals',
  'audit_log',
];
const TRIGGERS = [
  'trg_accounting_revisions_approved_immutable',
  ...TABLES.filter((t) => t !== 'period_change_proposals').map(
    (t) => `trg_${t}_append_only`,
  ),
];

/**
 * Migration `ReconciliationWorkflow` (plan 2.8 step 1): workflow columns of `accounting_revisions` with one
 * open revision per period, the workflow tables, the append-only and approved-immutability triggers;
 * `down()` removes all of it and restores the 2.5 indexes; the schema matches the entities.
 */
describe('ReconciliationWorkflow migration', () => {
  const harness = new IntegrationHarness();
  const q = <T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ) => harness.dataSource.query<T[]>(sql, params);
  const executed = async () =>
    (await q(`SELECT 1 FROM migrations WHERE name = $1`, [WORKFLOW])).length >
    0;
  const present = async (name: string) =>
    (
      await q<{ found: string | null }>(
        `SELECT to_regclass($1)::text AS found`,
        [`public.${name}`],
      )
    )[0].found !== null;
  const indexes = async () =>
    (
      await q<{ indexname: string }>(
        `SELECT indexname FROM pg_indexes WHERE tablename = 'accounting_revisions'`,
      )
    ).map((i) => i.indexname);
  const triggers = async () =>
    (
      await q<{ tgname: string }>(
        `SELECT tgname FROM pg_trigger WHERE tgname = ANY($1)`,
        [TRIGGERS],
      )
    ).map((t) => t.tgname);

  beforeAll(async () => {
    await harness.start();
  });
  afterAll(() => harness.stop());

  it('up: tables, open-revision index, triggers; the schema matches the entities', async () => {
    expect(await executed()).toBe(true);
    for (const table of TABLES) expect(await present(table)).toBe(true);
    expect(await indexes()).toEqual(
      expect.arrayContaining(['UQ_accounting_revisions_period_open']),
    );
    expect(await indexes()).not.toContain(
      'UQ_accounting_revisions_period_approved',
    );
    expect((await triggers()).sort()).toEqual([...TRIGGERS].sort());
    expect(await harness.pendingSchemaChanges()).toEqual([]);
  });

  it('down: removes everything and restores the 2.5 indexes; up again re-applies', async () => {
    while (await executed()) {
      await harness.dataSource.undoLastMigration({ transaction: 'all' });
    }
    for (const table of TABLES) expect(await present(table)).toBe(false);
    expect(await indexes()).toEqual(
      expect.arrayContaining([
        'UQ_accounting_revisions_period_draft',
        'UQ_accounting_revisions_period_approved',
      ]),
    );
    expect(await triggers()).toEqual([]);
    await harness.runMigrations();
    expect(await executed()).toBe(true);
    expect(await harness.pendingSchemaChanges()).toEqual([]);
  });
});
