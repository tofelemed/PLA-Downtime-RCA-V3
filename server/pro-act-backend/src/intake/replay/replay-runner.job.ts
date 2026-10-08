import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ShutdownCoordinator } from '../../common/scheduling/shutdown-coordinator.service';
import { ReplayService } from './replay.service';

/** Picks up queued replay runs every 5 s (worker/all roles only), one tick at a time per process. */
@Injectable()
export class ReplayRunnerJob {
  private readonly logger = new Logger(ReplayRunnerJob.name);
  private running = false;

  constructor(
    private readonly replays: ReplayService,
    private readonly shutdown: ShutdownCoordinator,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async tick(): Promise<void> {
    if (this.running || this.shutdown.isShuttingDown) return;
    this.running = true;
    try {
      const processed = await this.shutdown.track(this.replays.runPending());
      if (processed > 0) this.logger.log(`Ran ${processed} replay run(s)`);
    } catch (error) {
      this.logger.error(
        'Replay tick failed',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }
}
