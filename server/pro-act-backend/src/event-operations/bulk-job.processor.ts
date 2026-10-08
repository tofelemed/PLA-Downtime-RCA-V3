import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ShutdownCoordinator } from '../common/scheduling/shutdown-coordinator.service';
import { BulkJobService } from './bulk-job.service';

/** Polls queued bulk jobs (API04). Live only where the scheduler runs (PROCESS_ROLE worker/all). */
@Injectable()
export class BulkJobProcessor {
  private readonly logger = new Logger(BulkJobProcessor.name);

  constructor(
    private readonly jobs: BulkJobService,
    private readonly shutdown: ShutdownCoordinator,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async tick(): Promise<void> {
    if (this.shutdown.isShuttingDown) return;
    const processed = await this.shutdown.track(this.jobs.runPending());
    if (processed > 0) {
      this.logger.log(`Processed ${processed} bulk job(s)`);
    }
  }
}
