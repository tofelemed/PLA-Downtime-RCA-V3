import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ShutdownCoordinator } from '../common/scheduling/shutdown-coordinator.service';
import { WorkReminderNotifier } from './work-reminder-notifier';

/**
 * Time-based trigger of the work and downtime reminders (item 6): every 10 minutes (worker / all roles)
 * each active plant is evaluated at the current instant. Idempotent per user, record and level (see
 * `WorkReminderNotifier`), so overlapping or repeated runs and several workers never notify twice; a plant
 * that fails is logged and retried on the next run.
 */
@Injectable()
export class WorkReminderJob {
  private readonly logger = new Logger(WorkReminderJob.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly notifier: WorkReminderNotifier,
    private readonly shutdown: ShutdownCoordinator,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async run(): Promise<void> {
    if (this.shutdown.isShuttingDown) return;
    const created = await this.shutdown.track(this.sweep());
    if (created > 0) {
      this.logger.log(`Work reminder notifications created: ${created}`);
    }
  }

  async sweep(now: Date = new Date()): Promise<number> {
    const tenants: Array<{ id: string }> = await this.dataSource.query(
      `SELECT t."id"::text AS "id" FROM "tenants" t WHERE t."is_active" ORDER BY t."id"`,
    );
    let created = 0;
    for (const { id: tenantId } of tenants) {
      if (this.shutdown.isShuttingDown) break;
      try {
        created += await this.notifier.notify(tenantId, now);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Work reminder notifications of tenant ${tenantId} failed: ${message}`,
        );
      }
    }
    return created;
  }
}
