import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { QUEUE_WINDOW_DAYS } from '../close/reconciliation-queue.service';
import { ShutdownCoordinator } from '../common/scheduling/shutdown-coordinator.service';
import { SlaEscalationNotifier } from './sla-escalation-notifier';

/**
 * Time-based trigger of the SLA escalation notifications (SME R3 / R6): every 10 minutes (worker / all
 * roles) each plant with periods in the queue window is evaluated at the current instant. Idempotent per
 * user, period and escalation level (see `SlaEscalationNotifier`), so overlapping or repeated runs and
 * several workers never notify twice; a plant that fails is logged and retried on the next run.
 */
@Injectable()
export class SlaEscalationJob {
  private readonly logger = new Logger(SlaEscalationJob.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly notifier: SlaEscalationNotifier,
    private readonly shutdown: ShutdownCoordinator,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async run(): Promise<void> {
    if (this.shutdown.isShuttingDown) return;
    const created = await this.shutdown.track(this.sweep());
    if (created > 0) {
      this.logger.log(`SLA escalation notifications created: ${created}`);
    }
  }

  async sweep(now: Date = new Date()): Promise<number> {
    const since = new Date(now.getTime() - QUEUE_WINDOW_DAYS * 86_400_000);
    const tenants: Array<{ tenant_id: string }> = await this.dataSource.query(
      `SELECT t."id" AS "tenant_id" FROM "tenants" t
        WHERE EXISTS (SELECT 1 FROM "production_periods" p
                       WHERE p."tenant_id" = t."id" AND p."local_date" >= $1::date)
        ORDER BY t."id"`,
      [since.toISOString().slice(0, 10)],
    );
    let created = 0;
    for (const { tenant_id: tenantId } of tenants) {
      if (this.shutdown.isShuttingDown) break;
      try {
        created += await this.notifier.notify(tenantId, now);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `SLA escalation notifications of tenant ${tenantId} failed: ${message}`,
        );
      }
    }
    return created;
  }
}
