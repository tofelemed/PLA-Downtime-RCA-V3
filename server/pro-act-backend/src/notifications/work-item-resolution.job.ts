import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ShutdownCoordinator } from '../common/scheduling/shutdown-coordinator.service';
import { WorkItemResolver } from './work-item-resolver';

/**
 * Periodic reconciliation behind the event-driven resolution (owner 18 Oct): every minute (worker / all
 * roles) each plant with open work-item notifications is re-checked, which also covers work finished without
 * a domain message (an RCA action or task marked done, a due date moved). Idempotent; a plant that fails is
 * logged and retried on the next run.
 */
@Injectable()
export class WorkItemResolutionJob {
  private readonly logger = new Logger(WorkItemResolutionJob.name);

  constructor(
    private readonly resolver: WorkItemResolver,
    private readonly shutdown: ShutdownCoordinator,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async run(): Promise<void> {
    if (this.shutdown.isShuttingDown) return;
    const resolved = await this.shutdown.track(this.sweep());
    if (resolved > 0) {
      this.logger.log(`Work item notifications resolved: ${resolved}`);
    }
  }

  async sweep(now: Date = new Date()): Promise<number> {
    let resolved = 0;
    for (const tenantId of await this.resolver.tenantsWithOpenWork()) {
      if (this.shutdown.isShuttingDown) break;
      try {
        resolved += await this.resolver.resolve(tenantId, now);
      } catch (error: unknown) {
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Work item resolution of tenant ${tenantId} failed: ${reason}`,
        );
      }
    }
    return resolved;
  }
}
