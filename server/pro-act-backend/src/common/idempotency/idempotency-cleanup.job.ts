import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ShutdownCoordinator } from '../scheduling/shutdown-coordinator.service';
import { IdempotencyService } from './idempotency.service';

/** Hourly purge of idempotency keys past their 24 h retention (API02). Worker/all roles only. */
@Injectable()
export class IdempotencyCleanupJob {
  private readonly logger = new Logger(IdempotencyCleanupJob.name);

  constructor(
    private readonly idempotency: IdempotencyService,
    private readonly shutdown: ShutdownCoordinator,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async purge(): Promise<void> {
    if (this.shutdown.isShuttingDown) return;
    const removed = await this.shutdown.track(this.idempotency.purgeExpired());
    if (removed > 0) {
      this.logger.log(`Purged ${removed} expired idempotency key(s)`);
    }
  }
}
