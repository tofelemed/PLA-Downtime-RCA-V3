import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { envInt } from '../common/helpers/time-bounds';
import { ShutdownCoordinator } from '../common/scheduling/shutdown-coordinator.service';
import { PeriodMaterializerService } from './period-materializer.service';

const HOUR_MS = 3_600_000;

/**
 * SME D1 / D2: samples of the unit's mapped state signal (from one staleness span before the period to
 * its end) stored after the period's last completed recompute — the state timeline and its coverage KPIs
 * changed. Compared with the recompute's finish, not the actuals run (state samples never change actuals),
 * so an unchanged input hash does not queue the period again.
 */
const LATE_STATE_SAMPLES = `EXISTS (
                SELECT 1 FROM "unit_state_mappings" m JOIN "measurement_samples" s ON s."signal_id" = m."signal_id"
                 WHERE m."tenant_id" = p."tenant_id" AND m."unit_id" = p."unit_id"
                   AND m."effective_from" < p."utc_end" AND (m."effective_to" IS NULL OR m."effective_to" > p."utc_start")
                   AND s."tenant_id" = p."tenant_id"
                   AND s."observed_at" >= p."utc_start"
                       - make_interval(secs => m."expected_interval_seconds" * m."stale_after_intervals" + m."jitter_seconds")
                   AND s."observed_at" < p."utc_end"
                   AND s."inserted_at" > (SELECT max(j."finished_at") FROM "actuals_jobs" j
                                           WHERE j."period_id" = p."id" AND j."kind" = 'recompute' AND j."state" = 'completed'))`;

/**
 * Worker sweep of plan 2.4 (every 5 min, worker/all roles): materializes periods for shift instances that
 * have started in the last `PERIOD_MATERIALIZE_LOOKBACK_HOURS` (default 48) for every tenant with an
 * approved profile, then queues a recompute for each period that ended at least
 * `ACTUALS_SETTLE_SECONDS` (default 900 = the default max gap) and at most
 * `ACTUALS_RECHECK_DAYS` (default 7) ago and either has no actuals run yet, received samples after its
 * current run (late or corrected archive values), or whose current calculation run measured an open
 * event up to the run instant while the period was running (DT-08: once settled, the stop is measured
 * to the period end), or received state samples of its unit's state mapping after its last recompute
 * (SME D1 / D2). Output-event changes and reliability imports arrive through the outbox instead.
 */
@Injectable()
export class PeriodSweepJob {
  private readonly logger = new Logger(PeriodSweepJob.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly materializer: PeriodMaterializerService,
    private readonly shutdown: ShutdownCoordinator,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async run(): Promise<void> {
    if (this.shutdown.isShuttingDown) return;
    const result = await this.shutdown.track(this.sweep());
    if (result.created + result.queued > 0) {
      this.logger.log(
        `Periods created ${result.created}, recomputes queued ${result.queued}`,
      );
    }
  }

  async sweep(
    now: Date = new Date(),
  ): Promise<{ created: number; queued: number }> {
    const tenants: Array<{ tenant_id: string }> = await this.dataSource.query(
      `SELECT DISTINCT "tenant_id" FROM "production_profiles" WHERE "state" = 'approved'`,
    );
    let created = 0;
    let queued = 0;
    for (const { tenant_id: tenantId } of tenants) {
      if (this.shutdown.isShuttingDown) break;
      try {
        created += await this.materialize(tenantId, now);
        queued += await this.queueSettled(tenantId, now);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Period sweep of tenant ${tenantId} failed: ${message}`,
        );
      }
    }
    return { created, queued };
  }

  private async materialize(tenantId: string, now: Date): Promise<number> {
    const lookback = envInt('PERIOD_MATERIALIZE_LOOKBACK_HOURS', 48) * HOUR_MS;
    const result = await this.dataSource.transaction((manager) =>
      this.materializer.materialize(manager, {
        tenantId,
        unitIds: null,
        from: new Date(now.getTime() - lookback),
        to: now,
      }),
    );
    return result.created;
  }

  private async queueSettled(tenantId: string, now: Date): Promise<number> {
    const settle = envInt('ACTUALS_SETTLE_SECONDS', 900);
    const recheck = envInt('ACTUALS_RECHECK_DAYS', 7);
    const rows: unknown[] = await this.dataSource.query(
      `INSERT INTO "actuals_jobs" ("tenant_id", "row_version", "kind", "state", "period_id", "request")
       SELECT p."tenant_id", 1, 'recompute', 'queued', p."id", '{"trigger":"period_settled","scopeUnitIds":null}'::jsonb
         FROM "production_periods" p
         LEFT JOIN "actuals_runs" r ON r."id" = p."current_actuals_run_id"
        WHERE p."tenant_id" = $1 AND p."state_readiness" <> 'reconciled'
          AND p."utc_end" <= $2::timestamptz - make_interval(secs => $3)
          AND p."utc_end" > $2::timestamptz - make_interval(days => $4)
          AND (r."id" IS NULL OR EXISTS (
                SELECT 1 FROM "signals" g JOIN "measurement_samples" s ON s."signal_id" = g."id"
                 WHERE g."tenant_id" = p."tenant_id" AND g."unit_id" = p."unit_id"
                   AND g."semantic_type" IN ('counter', 'rate') AND g."effective_from" < p."utc_end"
                   AND (g."effective_to" IS NULL OR g."effective_to" > p."utc_start")
                   AND s."tenant_id" = p."tenant_id"
                   AND s."observed_at" >= p."utc_start" - make_interval(secs => g."max_gap_seconds")
                   AND s."observed_at" < p."utc_end" + make_interval(secs => g."max_gap_seconds")
                   AND s."inserted_at" > r."computed_at")
               OR EXISTS (
                SELECT 1 FROM "accounting_revisions" ar
                  JOIN "calculation_runs" cr ON cr."id" = ar."current_run_id"
                 WHERE ar."period_id" = p."id" AND ar."lifecycle" IN ('draft', 'in_review')
                   AND cr."input_fingerprint"->>'asOf' IS NOT NULL)
               OR ${LATE_STATE_SAMPLES})
       ON CONFLICT ("period_id") WHERE "state" = 'queued' AND "kind" = 'recompute' DO NOTHING
       RETURNING "id"`,
      [tenantId, now, settle, recheck],
    );
    return rows.length;
  }
}
