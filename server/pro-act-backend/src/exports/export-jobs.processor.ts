import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ShutdownCoordinator } from '../common/scheduling/shutdown-coordinator.service';
import { ExportJobsService } from './export-jobs.service';

/** Polls queued export jobs and purges expired files (plan 2.9). Live only where the scheduler runs. */
@Injectable()
export class ExportJobsProcessor {
  private readonly logger = new Logger(ExportJobsProcessor.name);

  constructor(
    private readonly jobs: ExportJobsService,
    private readonly shutdown: ShutdownCoordinator,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async tick(): Promise<void> {
    if (this.shutdown.isShuttingDown) return;
    const processed = await this.shutdown.track(this.jobs.runPending());
    if (processed > 0) this.logger.log(`Processed ${processed} export job(s)`);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async purge(): Promise<void> {
    if (this.shutdown.isShuttingDown) return;
    const purged = await this.shutdown.track(this.jobs.purgeExpired());
    if (purged > 0) this.logger.log(`Purged ${purged} expired export file(s)`);
  }
}
