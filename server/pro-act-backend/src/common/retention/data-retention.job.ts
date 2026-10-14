import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ShutdownCoordinator } from '../scheduling/shutdown-coordinator.service';
import {
  DataRetentionService,
  RetentionResult,
} from './data-retention.service';
import {
  isRetentionEnabled,
  readRetentionPolicy,
  RetentionPolicy,
} from './retention-policy';

const window = (days: number | null) => (days === null ? 'keep' : `${days} d`);

/** One log line per run: the windows applied and what went. */
const describeRun = (policy: RetentionPolicy, result: RetentionResult) =>
  `Retention (request log ${window(policy.requestLogDays)}, audit trail ${window(policy.auditTrailDays)}, ` +
  `raw ${window(policy.rawDays)}) deleted ${result.requestLog} request-log and ${result.auditTrail} ` +
  `audit-trail row(s); dropped raw partitions: ${result.rawPartitions.join(', ') || 'none'}`;

/**
 * Daily data retention (DB-07, worker/all roles): the audit request log, the audit trail and old raw
 * observation partitions, by the windows of `readRetentionPolicy`. Unset = keep forever; the owner set
 * both audit tables to 30 days (2026-10-14, passed by docker-compose), raw retention is not decided. A
 * bad value is logged and nothing is deleted.
 */
@Injectable()
export class DataRetentionJob {
  private readonly logger = new Logger(DataRetentionJob.name);
  private running = false;

  constructor(
    private readonly retention: DataRetentionService,
    private readonly shutdown: ShutdownCoordinator,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async run(): Promise<void> {
    if (this.running || this.shutdown.isShuttingDown) return;
    this.running = true;
    try {
      const policy = readRetentionPolicy();
      if (!isRetentionEnabled(policy)) return;
      const result = await this.shutdown.track(
        this.retention.apply(new Date(), policy),
      );
      this.logger.log(describeRun(policy, result));
    } catch (error) {
      this.logger.error(
        'Data retention failed',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }
}
