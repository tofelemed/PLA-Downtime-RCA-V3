import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ShutdownCoordinator } from '../common/scheduling/shutdown-coordinator.service';
import { ActualsJobsService } from './actuals-jobs.service';

/** Polls queued actuals jobs (plan 2.4, API04). Live only where the scheduler runs. */
@Injectable()
export class ActualsProcessor {
  private readonly logger = new Logger(ActualsProcessor.name);

  constructor(
    private readonly jobs: ActualsJobsService,
    private readonly shutdown: ShutdownCoordinator,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async tick(): Promise<void> {
    if (this.shutdown.isShuttingDown) return;
    const processed = await this.shutdown.track(this.jobs.runPending());
    if (processed > 0) this.logger.log(`Processed ${processed} actuals job(s)`);
  }
}
