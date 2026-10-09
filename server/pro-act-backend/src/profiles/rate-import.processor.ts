import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ShutdownCoordinator } from '../common/scheduling/shutdown-coordinator.service';
import { RateImportRunner } from './rate-import.runner';

/** Polls queued rate imports (plan 2.2, API04). Live only where the scheduler runs (worker/all). */
@Injectable()
export class RateImportProcessor {
  private readonly logger = new Logger(RateImportProcessor.name);

  constructor(
    private readonly runner: RateImportRunner,
    private readonly shutdown: ShutdownCoordinator,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async tick(): Promise<void> {
    if (this.shutdown.isShuttingDown) return;
    const processed = await this.shutdown.track(this.runner.runPending());
    if (processed > 0) this.logger.log(`Processed ${processed} rate import(s)`);
  }
}
