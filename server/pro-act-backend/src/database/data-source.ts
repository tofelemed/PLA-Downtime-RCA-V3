import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import {
  dbMigrationsDir,
  dbSsl,
  dbUser,
  schemaPoolOptions,
} from './connection-env';
import { SlowQueryLogger } from './slow-query.logger';

// `.env` is read from the working directory (server/pro-act-backend), the same way app.module.ts
// loads it. Resolving relative to __dirname would break under the compiled layout (dist/src/database).
dotenv.config();

// Globs are anchored on this file so they work from src/database (ts-node, Jest) and dist/src/database
// (compiled) alike. Forward slashes keep them valid on Windows as well as Linux.
const here = __dirname.replace(/\\/g, '/');

/**
 * Single source of truth for the database connection, shared by the Nest application
 * (TypeOrmModule.forRoot) and the TypeORM CLI (migration:generate/run/revert/show).
 *
 * Schema changes are migrations under src/database/migrations; `synchronize` stays off everywhere.
 */
export function dataSourceOptionsFrom(
  env: NodeJS.ProcessEnv = process.env,
): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.DB_HOST || 'localhost',
    port: parseInt(env.DB_PORT || '5432', 10),
    username: dbUser(env),
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME || 'traverse_forge',
    ssl: dbSsl(env),
    extra: schemaPoolOptions(env),
    entities: [`${here}/../**/*.entity{.ts,.js}`],
    migrations: [`${dbMigrationsDir(env, `${here}/migrations`)}/*{.ts,.js}`],
    synchronize: false,
    logging: env.DB_LOGGING === 'true',
  };
}

export const dataSourceOptions: DataSourceOptions = dataSourceOptionsFrom();

export const AppDataSource = new DataSource(dataSourceOptions);

function positiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Connection settings of the long-running API and worker processes (plan 3.11, ENGINEERING_STANDARDS):
 * pool size `DB_POOL_MAX` (10), `statement_timeout` `DB_STATEMENT_TIMEOUT_MS` (30 s), connect timeout
 * `DB_CONNECT_TIMEOUT_MS` (10 s), slow-query warning above `DB_SLOW_QUERY_MS` (500 ms). Migrations and
 * CLIs keep `dataSourceOptions` (no statement timeout: a backfill may legitimately run longer).
 */
export function runtimeDataSourceOptions(
  env: NodeJS.ProcessEnv = process.env,
): DataSourceOptions {
  return {
    ...dataSourceOptionsFrom(env),
    migrationsRun: false,
    maxQueryExecutionTime: positiveInt(env.DB_SLOW_QUERY_MS, 500),
    logger: new SlowQueryLogger(env.DB_LOGGING === 'true'),
    extra: {
      ...schemaPoolOptions(env),
      max: positiveInt(env.DB_POOL_MAX, 10),
      statement_timeout: positiveInt(env.DB_STATEMENT_TIMEOUT_MS, 30_000),
      connectionTimeoutMillis: positiveInt(env.DB_CONNECT_TIMEOUT_MS, 10_000),
    },
  };
}
