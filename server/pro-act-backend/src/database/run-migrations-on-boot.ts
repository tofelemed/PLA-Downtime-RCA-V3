import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';

/**
 * Applies pending migrations before the API starts, on a dedicated connection without the runtime
 * statement timeout (plan 3.11), all in one transaction. Opt-in (`DB_MIGRATIONS_RUN=true`, set by the
 * development `.env` and docker-compose.yml): production images apply the schema as an explicit release
 * step with the migration scripts under deploy/db (TF-PREP-001 §4.6).
 */
export async function runMigrationsOnBoot(
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  if (env.DB_MIGRATIONS_RUN !== 'true') return;
  const logger = new Logger('Migrations');
  const dataSource = new DataSource({
    ...dataSourceOptions,
    migrationsRun: false,
  });
  await dataSource.initialize();
  try {
    const applied = await dataSource.runMigrations({ transaction: 'all' });
    if (applied.length > 0) {
      logger.log(
        `Applied ${applied.length} migration(s): ${applied.map((m) => m.name).join(', ')}`,
      );
    }
  } finally {
    await dataSource.destroy();
  }
}
