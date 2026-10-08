import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ShutdownCoordinator } from '../../common/scheduling/shutdown-coordinator.service';

/** Months created ahead of time by the daily maintenance run. */
const MONTHS_AHEAD = 2;

/**
 * Monthly partitions of `raw_observations` (plan 1.5 step 2). The worker creates the current and the
 * next two months every day; intake also ensures the month of a write once per process and month, so a
 * missed maintenance run never makes an insert fail. Creation is `raw_observations_ensure_partition()`
 * (migration IntakeCore), idempotent. Retention (dropping old partitions) is a later decision.
 */
@Injectable()
export class RawPartitionsService {
  private readonly logger = new Logger(RawPartitionsService.name);
  private readonly ensured = new Set<string>();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly shutdown: ShutdownCoordinator,
  ) {}

  /** Makes sure the partition holding `at` exists (one query per process and month). */
  async ensureFor(at: Date): Promise<void> {
    const month = at.toISOString().slice(0, 7);
    if (this.ensured.has(month)) return;
    await this.dataSource.query(
      `SELECT "raw_observations_ensure_partition"($1::timestamptz)`,
      [at],
    );
    this.ensured.add(month);
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async maintain(): Promise<string[]> {
    if (this.shutdown.isShuttingDown) return [];
    const rows: Array<{ name: string }> = await this.shutdown.track(
      this.dataSource.query(
        `SELECT "raw_observations_ensure_partition"(now() + make_interval(months => m)) AS "name"
           FROM generate_series(0, $1) AS m`,
        [MONTHS_AHEAD],
      ),
    );
    const names = rows.map((row) => row.name);
    this.logger.log(`Raw observation partitions present: ${names.join(', ')}`);
    return names;
  }
}
