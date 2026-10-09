import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ShutdownCoordinator } from '../common/scheduling/shutdown-coordinator.service';
import { PlanGenerationJobsService } from './plan-generation-jobs.service';

/** Polls queued plan period generations (plan 2.3, API04). Live only where the scheduler runs. */
@Injectable()
export class PlanGenerationProcessor {
  private readonly logger = new Logger(PlanGenerationProcessor.name);

  constructor(
    private readonly jobs: PlanGenerationJobsService,
    private readonly shutdown: ShutdownCoordinator,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async tick(): Promise<void> {
    if (this.shutdown.isShuttingDown) return;
    const processed = await this.shutdown.track(this.jobs.runPending());
    if (processed > 0)
      this.logger.log(`Processed ${processed} plan generation job(s)`);
  }
}
