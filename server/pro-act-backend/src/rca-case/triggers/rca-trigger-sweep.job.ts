import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { envInt } from '../../common/helpers/time-bounds';
import { ShutdownCoordinator } from '../../common/scheduling/shutdown-coordinator.service';
import { RcaTriggerService } from './rca-trigger.service';

/**
 * Open events change no row while their elapsed time grows, so no `EventChanged` arrives when they cross
 * a threshold: this worker sweep (every 5 min, worker/all roles) re-evaluates open events of tenants
 * with `v2.rca` on, oldest first, at most `RCA_SWEEP_BATCH` (default 500) per run. Provisional
 * firings are recorded once; closure confirms them through the event consumer.
 */
@Injectable()
export class RcaTriggerSweepJob {
  private readonly logger = new Logger(RcaTriggerSweepJob.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly triggers: RcaTriggerService,
    private readonly shutdown: ShutdownCoordinator,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async run(): Promise<void> {
    if (this.shutdown.isShuttingDown) return;
    const fired = await this.shutdown.track(this.sweep());
    if (fired > 0) this.logger.log(`RCA sweep recorded ${fired} new firing(s)`);
  }

  async sweep(now: Date = new Date()): Promise<number> {
    const rows: Array<{ id: string; tenant_id: string }> =
      await this.dataSource.query(
        `SELECT e."id", e."tenant_id" FROM "production_events" e
         JOIN "feature_flags" f ON f."tenant_id"::text = e."tenant_id" AND f."key" = 'v2.rca' AND f."enabled"
        WHERE e."end_time" IS NULL AND e."physical_state" = 'open' AND e."start_time" < $1
        ORDER BY e."start_time", e."id" LIMIT $2`,
        [now, envInt('RCA_SWEEP_BATCH', 500)],
      );
    let fired = 0;
    for (const row of rows) {
      if (this.shutdown.isShuttingDown) break;
      try {
        const results = await this.triggers.evaluate(
          row.tenant_id,
          row.id,
          now,
        );
        fired += results.filter(
          (r) => r.outcome !== 'suppressed_duplicate',
        ).length;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`RCA sweep of event ${row.id} failed: ${message}`);
      }
    }
    return fired;
  }
}
