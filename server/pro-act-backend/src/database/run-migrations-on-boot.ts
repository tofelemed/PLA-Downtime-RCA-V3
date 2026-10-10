import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';

/**
 * Applies pending migrations before the API starts (`DB_MIGRATIONS_RUN`, default true), on a dedicated
 * connection without the runtime statement timeout (plan 3.11), all in one transaction as before.
 */
export async function runMigrationsOnBoot(
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  if (env.DB_MIGRATIONS_RUN === 'false') return;
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
