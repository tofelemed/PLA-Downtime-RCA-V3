import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { envInt } from '../helpers/time-bounds';
import { ShutdownCoordinator } from '../scheduling/shutdown-coordinator.service';
import { OutboxRetentionService } from './outbox-retention.service';

/**
 * Daily retention of the outbox and inbox (DB-07, worker/all roles): `OUTBOX_RETENTION_DAYS` (default
 * 90) and `OUTBOX_RETENTION_BATCH` rows per statement (default 1000).
 */
@Injectable()
export class OutboxRetentionJob {
  private readonly logger = new Logger(OutboxRetentionJob.name);
  private running = false;

  constructor(
    private readonly retention: OutboxRetentionService,
    private readonly shutdown: ShutdownCoordinator,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async run(): Promise<void> {
    if (this.running || this.shutdown.isShuttingDown) return;
    this.running = true;
    try {
      const result = await this.shutdown.track(
        this.retention.purge(new Date(), {
          retentionDays: envInt('OUTBOX_RETENTION_DAYS', 90),
          batchSize: envInt('OUTBOX_RETENTION_BATCH', 1000),
        }),
      );
      if (result.outbox + result.inbox > 0) {
        this.logger.log(
          `Retention deleted ${result.outbox} outbox and ${result.inbox} inbox row(s)`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Outbox retention failed',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }
}
