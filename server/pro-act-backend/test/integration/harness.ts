import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { dataSourceOptions } from '../../src/database/data-source';

type PostgresOptions = Extract<DataSourceOptions, { type: 'postgres' }>;

/** Integration tests run against their own database so `proact` (dev data) is never touched. */
export const TEST_DB_NAME = process.env.TEST_DB_NAME || 'proact_test';

const MIGRATIONS_TABLE = 'migrations';
/** TypeORM stores generated-column expressions here (production_events.duration_seconds). */
const TYPEORM_METADATA_TABLE = 'typeorm_metadata';
const TEST_DB_PATTERN = /^[a-z][a-z0-9_]*_test$/;
const DUPLICATE_DATABASE = '42P04';

function assertTestDatabaseName(database: string): void {
  if (!TEST_DB_PATTERN.test(database)) {
    throw new Error(
      `Refusing to use "${database}" for integration tests: the name must match ${TEST_DB_PATTERN} ` +
        'so a dev or production database can never be reset by a test run.',
    );
  }
}

function postgresOptions(
  database: string,
  overrides: Partial<PostgresOptions> = {},
): PostgresOptions {
  return {
    ...(dataSourceOptions as PostgresOptions),
    database,
    synchronize: false,
    migrationsRun: false,
    logging: false,
    ...overrides,
  };
}

async function withConnection<T>(
  options: PostgresOptions,
  work: (connection: DataSource) => Promise<T>,
): Promise<T> {
  const connection = new DataSource(options);
  await connection.initialize();
  try {
    return await work(connection);
  } finally {
    await connection.destroy();
  }
}

function isDuplicateDatabase(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === DUPLICATE_DATABASE
  );
}

/**
 * Creates the integration database if it is missing (via the `postgres` maintenance database on
 * the connection from .env) and makes sure uuid-ossp is available in it.
 */
export async function ensureTestDatabase(
  database = TEST_DB_NAME,
): Promise<void> {
  assertTestDatabaseName(database);
  const bare = { entities: [], migrations: [] };
  await withConnection(postgresOptions('postgres', bare), async (admin) => {
    const rows: unknown[] = await admin.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [database],
    );
    if (rows.length > 0) return;
    try {
      await admin.query(`CREATE DATABASE "${database}"`);
    } catch (error) {
      // Two workers racing to create it is harmless
      if (!isDuplicateDatabase(error)) throw error;
    }
  });
  await withConnection(postgresOptions(database, bare), (target) =>
    target.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'),
  );
}

/**
 * Lifecycle helper for integration suites: one DataSource per test file on `proact_test`,
 * built from the application's dataSourceOptions, brought to the latest migration before the
 * suite and truncated between tests. Suites sharing the database must run serially (--runInBand).
 */
export class IntegrationHarness {
  readonly database: string;
  readonly dataSource: DataSource;

  constructor(options: Partial<PostgresOptions> = {}) {
    this.database = options.database ?? TEST_DB_NAME;
    assertTestDatabaseName(this.database);
    this.dataSource = new DataSource(postgresOptions(this.database, options));
  }

  /** Ensures the database exists and connects; the schema is left as found. */
  async connect(): Promise<DataSource> {
    await ensureTestDatabase(this.database);
    if (!this.dataSource.isInitialized) await this.dataSource.initialize();
    return this.dataSource;
  }

  /** Connects, recreates the public schema and applies every migration: the default for suites. */
  async start(): Promise<DataSource> {
    await this.connect();
    await this.resetSchema();
    await this.runMigrations();
    return this.dataSource;
  }

  async stop(): Promise<void> {
    if (this.dataSource.isInitialized) await this.dataSource.destroy();
  }

  /** Drops everything in `public` (tables, the migrations table and uuid-ossp with it). */
  async resetSchema(): Promise<void> {
    await this.dataSource.query('DROP SCHEMA public CASCADE');
    await this.dataSource.query('CREATE SCHEMA public');
  }

  /** Applies pending migrations; returns how many ran. */
  async runMigrations(): Promise<number> {
    const executed = await this.dataSource.runMigrations({
      transaction: 'all',
    });
    return executed.length;
  }

  /** Reverts applied migrations one by one until none is left; returns how many were reverted. */
  async revertAllMigrations(): Promise<number> {
    let reverted = 0;
    while ((await this.executedMigrationCount()) > 0) {
      await this.dataSource.undoLastMigration({ transaction: 'all' });
      reverted += 1;
    }
    return reverted;
  }

  async executedMigrationCount(): Promise<number> {
    const present: Array<{ exists: boolean }> = await this.dataSource.query(
      'SELECT to_regclass($1) IS NOT NULL AS exists',
      [`public.${MIGRATIONS_TABLE}`],
    );
    if (!present[0]?.exists) return 0;
    const rows: Array<{ count: number }> = await this.dataSource.query(
      `SELECT count(*)::int AS count FROM "${MIGRATIONS_TABLE}"`,
    );
    return rows[0]?.count ?? 0;
  }

  /**
   * Names of base tables in `public`, excluding TypeORM bookkeeping (migrations, generated-column
   * metadata) and partitions (`raw_observations_y2026m10` ...): a partitioned table counts once.
   */
  async tableNames(): Promise<string[]> {
    const rows: Array<{ table_name: string }> = await this.dataSource.query(
      `SELECT t.table_name FROM information_schema.tables t
         JOIN pg_class c ON c.relname = t.table_name
         JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.table_schema
        WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE' AND t.table_name <> ALL($1)
          AND NOT c.relispartition
        ORDER BY t.table_name`,
      [[MIGRATIONS_TABLE, TYPEORM_METADATA_TABLE]],
    );
    return rows.map((row) => row.table_name);
  }

  async countTables(): Promise<number> {
    return (await this.tableNames()).length;
  }

  /** Empties every application table (keeps the schema and the bookkeeping tables). */
  async truncateAll(): Promise<void> {
    const tables = await this.tableNames();
    if (tables.length === 0) return;
    const list = tables.map((name) => `"public"."${name}"`).join(', ');
    await this.dataSource.query(
      `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`,
    );
  }

  /** DDL that TypeORM would emit to make the database match the entities; empty means parity. */
  async pendingSchemaChanges(): Promise<string[]> {
    const sql = await this.dataSource.driver.createSchemaBuilder().log();
    return sql.upQueries.map((query) => query.query);
  }
}
