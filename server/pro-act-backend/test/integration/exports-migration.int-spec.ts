import { IntegrationHarness } from './harness';

const EXPORTS = 'ExportsAndDomainEvents1792707200000';
const TABLES = ['export_jobs', 'export_job_sources'];
const TRIGGERS = [
  'trg_export_jobs_completed_immutable',
  'trg_export_job_sources_append_only',
];

/**
 * Migration `ExportsAndDomainEvents` (plan 2.9 step 1): export jobs and their pinned sources, the
 * completed-export immutability and append-only triggers, the approved-revision index; `down()` removes all
 * of it; the schema matches the entities.
 */
describe('ExportsAndDomainEvents migration', () => {
  const harness = new IntegrationHarness();
  const q = <T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ) => harness.dataSource.query<T[]>(sql, params);
  const executed = async () =>
    (await q(`SELECT 1 FROM migrations WHERE name = $1`, [EXPORTS])).length > 0;
  const present = async (name: string) =>
    (
      await q<{ found: string | null }>(
        `SELECT to_regclass($1)::text AS found`,
        [`public.${name}`],
      )
    )[0].found !== null;
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

  it('up: tables, triggers and the approved-revision index; the schema matches the entities', async () => {
    expect(await executed()).toBe(true);
    for (const table of TABLES) expect(await present(table)).toBe(true);
    expect(await present('"IDX_accounting_revisions_tenant_approved"')).toBe(
      true,
    );
    expect((await triggers()).sort()).toEqual([...TRIGGERS].sort());
    expect(await harness.pendingSchemaChanges()).toEqual([]);
  });

  it('down: removes everything; up again re-applies', async () => {
    while (await executed()) {
      await harness.dataSource.undoLastMigration({ transaction: 'all' });
    }
    for (const table of TABLES) expect(await present(table)).toBe(false);
    expect(await present('"IDX_accounting_revisions_tenant_approved"')).toBe(
      false,
    );
    expect(await triggers()).toEqual([]);
    await harness.runMigrations();
    expect(await executed()).toBe(true);
    expect(await harness.pendingSchemaChanges()).toEqual([]);
  });
});
