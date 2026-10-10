import { Logger as NestLogger } from '@nestjs/common';
import { Logger as TypeOrmLogger } from 'typeorm';
import { redactSecrets } from '../common/logging/redact';

const MAX_SQL_LENGTH = 2000;

function shorten(sql: string): string {
  const flat = sql.replace(/\s+/g, ' ').trim();
  return flat.length > MAX_SQL_LENGTH
    ? `${flat.slice(0, MAX_SQL_LENGTH)}…`
    : flat;
}

/**
 * TypeORM logger of the API and worker (plan 3.11, ENGINEERING_STANDARDS "slow-query logging"): every
 * statement slower than `maxQueryExecutionTime` is a warning with its duration and redacted SQL, never
 * its parameters (they may hold credentials). Query logging (`DB_LOGGING=true`) follows the same rule.
 */
export class SlowQueryLogger implements TypeOrmLogger {
  private readonly logger = new NestLogger('SlowQuery');

  constructor(private readonly logQueries = false) {}

  logQuerySlow(time: number, query: string): void {
    this.logger.warn(`${time} ms: ${redactSecrets(shorten(query))}`);
  }

  logQuery(query: string): void {
    if (this.logQueries) this.logger.debug(redactSecrets(shorten(query)));
  }

  logQueryError(error: string | Error, query: string): void {
    if (!this.logQueries) return;
    const message = error instanceof Error ? error.message : error;
    this.logger.warn(`${message}: ${redactSecrets(shorten(query))}`);
  }

  logSchemaBuild(): void {}

  logMigration(message: string): void {
    this.logger.log(message);
  }

  log(level: 'log' | 'info' | 'warn', message: unknown): void {
    if (level === 'warn') this.logger.warn(String(message));
  }
}
