import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ShutdownCoordinator } from '../../common/scheduling/shutdown-coordinator.service';
import { AuthTokenService } from './auth-token.service';

/** Hourly purge of refresh-token records a day past their expiry (plan 3.11). Worker/all roles only. */
@Injectable()
export class RefreshTokenCleanupJob {
  private readonly logger = new Logger(RefreshTokenCleanupJob.name);

  constructor(
    private readonly tokens: AuthTokenService,
    private readonly shutdown: ShutdownCoordinator,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async purge(): Promise<void> {
    if (this.shutdown.isShuttingDown) return;
    const removed = await this.shutdown.track(this.tokens.purgeExpired());
    if (removed > 0) {
      this.logger.log(`Purged ${removed} expired refresh token record(s)`);
    }
  }
}
