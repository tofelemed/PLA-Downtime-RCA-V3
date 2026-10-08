import { IntegrationHarness } from './harness';

/**
 * Migration round-trip (plan 0.3, spec MIG02 / §19.3): every migration goes up on an empty
 * schema, comes back down to nothing, and goes up again. The up-to-date schema must also match
 * the entity metadata exactly, which is what `migration:generate` checks for drift.
 */
describe('migrations', () => {
  const harness = new IntegrationHarness();
  let entityTables: number;

  beforeAll(async () => {
    await harness.connect();
    await harness.resetSchema();
    entityTables = harness.dataSource.entityMetadatas.length;
  });

  afterAll(async () => {
    await harness.stop();
  });

  it('starts from an empty schema', async () => {
    expect(await harness.countTables()).toBe(0);
    expect(await harness.executedMigrationCount()).toBe(0);
  });

  it('creates one table per entity when all migrations run', async () => {
    const executed = await harness.runMigrations();

    expect(executed).toBeGreaterThanOrEqual(1);
    expect(entityTables).toBeGreaterThan(0);
    expect(await harness.countTables()).toBe(entityTables);
    expect(await harness.executedMigrationCount()).toBe(executed);
  });

  it('matches the entity metadata with no pending schema changes', async () => {
    expect(await harness.pendingSchemaChanges()).toEqual([]);
  });

  it('reverts every migration back to an empty schema', async () => {
    const applied = await harness.executedMigrationCount();

    const reverted = await harness.revertAllMigrations();

    expect(reverted).toBe(applied);
    expect(await harness.executedMigrationCount()).toBe(0);
    expect(await harness.tableNames()).toEqual([]);
  });

  it('runs up again after a full revert', async () => {
    await harness.runMigrations();

    expect(await harness.countTables()).toBe(entityTables);
    expect(await harness.pendingSchemaChanges()).toEqual([]);
  });

  it('truncateAll keeps the schema and the migration history', async () => {
    await harness.truncateAll();

    expect(await harness.countTables()).toBe(entityTables);
    expect(await harness.executedMigrationCount()).toBeGreaterThanOrEqual(1);
  });
});
