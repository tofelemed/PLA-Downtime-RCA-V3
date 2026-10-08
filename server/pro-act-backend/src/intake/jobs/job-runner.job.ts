import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ShutdownCoordinator } from '../../common/scheduling/shutdown-coordinator.service';
import { JobRunnerService } from './job-runner.service';

/**
 * Polls due ingestion jobs every 5 s where the scheduler runs (worker/all). One tick at a time per
 * process; shutdown waits for the in-flight page (its cursor is committed before the process exits).
 */
@Injectable()
export class JobRunnerJob {
  private readonly logger = new Logger(JobRunnerJob.name);
  private running = false;

  constructor(
    private readonly runner: JobRunnerService,
    private readonly shutdown: ShutdownCoordinator,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async tick(): Promise<void> {
    if (this.running || this.shutdown.isShuttingDown) return;
    this.running = true;
    try {
      const outcomes = await this.shutdown.track(this.runner.runDue());
      if (outcomes.length > 0) {
        this.logger.log(`Ran ${outcomes.length} ingestion page(s)`);
      }
    } catch (error) {
      this.logger.error(
        'Ingestion job tick failed',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }
}
