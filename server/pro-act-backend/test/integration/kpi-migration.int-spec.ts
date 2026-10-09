import { IntegrationHarness } from './harness';

const KPI = 'KpiResults1792793600000';
const RELATIONS = ['kpi_results', 'failure_events_v', 'oee_summaries_v'];

/**
 * Migration `KpiResults` (plan 2.7 step 1): `kpi_results` with its enums, indexes and immutability
 * trigger, the D13 `failure_events_v` and the v1 `oee_summaries_v`; `down()` removes all of it (and only
 * it — the accounting function it reuses stays); the schema matches the entities.
 */
describe('KpiResults migration', () => {
  const harness = new IntegrationHarness();
  const q = <T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ) => harness.dataSource.query<T[]>(sql, params);
  const executed = async () =>
    (await q(`SELECT 1 FROM migrations WHERE name = $1`, [KPI])).length > 0;
  const present = async (name: string) =>
    (
      await q<{ found: string | null }>(
        `SELECT to_regclass($1)::text AS found`,
        [`public.${name}`],
      )
    )[0].found !== null;
  const trigger = async () =>
    (
      await q(
        `SELECT 1 FROM pg_trigger WHERE tgname = 'trg_kpi_results_immutable'`,
      )
    ).length > 0;
  const accountingFunction = async () =>
    (
      await q(
        `SELECT 1 FROM pg_proc WHERE proname = 'accounting_lines_immutable'`,
      )
    ).length > 0;

  beforeAll(async () => {
    await harness.start();
  });
  afterAll(() => harness.stop());

  it('up: table, views, index and trigger; the schema matches the entities', async () => {
    expect(await executed()).toBe(true);
    for (const name of RELATIONS) expect(await present(name)).toBe(true);
    expect(await present('"IDX_kpi_results_tenant_run_metric"')).toBe(true);
    expect(await trigger()).toBe(true);
    expect(await harness.pendingSchemaChanges()).toEqual([]);
  });

  it('down: removes everything it created; up again re-applies', async () => {
    while (await executed()) {
      await harness.dataSource.undoLastMigration({ transaction: 'all' });
    }
    for (const name of RELATIONS) expect(await present(name)).toBe(false);
    expect(await trigger()).toBe(false);
    expect(await accountingFunction()).toBe(true);
    await harness.runMigrations();
    expect(await executed()).toBe(true);
    expect(await harness.pendingSchemaChanges()).toEqual([]);
  });
});
