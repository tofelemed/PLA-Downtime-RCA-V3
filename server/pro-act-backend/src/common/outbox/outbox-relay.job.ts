import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ShutdownCoordinator } from '../scheduling/shutdown-coordinator.service';
import { OutboxRelayService } from './outbox-relay.service';

const MAX_BATCHES_PER_TICK = 20;

/** Drains the outbox every second (worker/all roles only); one tick at a time per process. */
@Injectable()
export class OutboxRelayJob {
  private readonly logger = new Logger(OutboxRelayJob.name);
  private running = false;

  constructor(
    private readonly relay: OutboxRelayService,
    private readonly shutdown: ShutdownCoordinator,
  ) {}

  @Cron(CronExpression.EVERY_SECOND)
  async tick(): Promise<void> {
    if (this.running || this.shutdown.isShuttingDown) return;
    this.running = true;
    try {
      await this.shutdown.track(this.drain());
    } catch (error) {
      this.logger.error(
        'Outbox relay tick failed',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }

  private async drain(): Promise<void> {
    for (let batch = 0; batch < MAX_BATCHES_PER_TICK; batch++) {
      if (this.shutdown.isShuttingDown) return;
      const result = await this.relay.relayBatch();
      if (result.published + result.failed + result.deferred === 0) return;
    }
  }
}
