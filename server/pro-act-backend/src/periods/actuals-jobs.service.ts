import { HttpException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';
import { requireTenantRole } from '../auth/roles/require-tenant-role';
import { requireUnitRole } from '../auth/roles/require-unit-role';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { envInt } from '../common/helpers/time-bounds';
import { scopedQuery } from '../common/query/scoped-query';
import { runnerIdentity } from '../common/scheduling/runner-identity';
import { notFound } from '../profiles/profile-errors';
import { ActualsRunnerService } from './actuals-runner.service';
import { ActualsJob } from './entities/actuals-job.entity';
import { PeriodProductSlice } from './entities/period-product-slice.entity';
import { ProductionPeriod } from './entities/production-period.entity';
import { ExternalReportsService } from './external-reports.service';
import { PeriodRecomputePort } from './period-recompute.port';
import {
  assertPeriodUnitInScope,
  assertTenantWide,
  periodScopeUnits,
  scopeCovers,
} from './period-scope';
import { SliceResolverService } from './slice-resolver.service';
import { PERIOD_WRITERS, REPORT_IMPORTERS } from '../v2/periods/period-roles';

type Outcome =
  | { state: 'completed'; result: Record<string, unknown> }
  | { state: 'failed'; code: string; message: string };

/** Window of periods to queue recomputes for. */
export interface RecomputeWindow {
  tenantId: string;
  unitIds: string[] | null;
  from: Date;
  to: Date | null;
  trigger: string;
  scopeUnitIds: string[] | null;
  requestedBy: string | null;
}

/**
 * Leased actuals jobs (plan 2.4, API04): `recompute` (one period, collapsed while queued) and
 * `report_import` (CSV). Requests record the requester's unit scope; the worker claims jobs with
 * `FOR UPDATE SKIP LOCKED` under a lease and re-checks that scope before writing (a unit-limited requester
 * never makes a job compute another unit's period).
 */
@Injectable()
export class ActualsJobsService {
  private readonly logger = new Logger(ActualsJobsService.name);

  constructor(
    @InjectRepository(ActualsJob) private readonly jobs: Repository<ActualsJob>,
    private readonly runner: ActualsRunnerService,
    private readonly reports: ExternalReportsService,
    private readonly recompute: PeriodRecomputePort,
    private readonly slices: SliceResolverService,
  ) {}

  /** 202 recompute of one period of the caller's scope (404 otherwise); returns the queued job. */
  async requestRecompute(
    context: RequestContext,
    periodId: string,
  ): Promise<ActualsJob> {
    const period = await scopedQuery(
      this.jobs.manager.getRepository(ProductionPeriod),
      'p',
      { context, unitProperty: 'unitId' },
    )
      .andWhere('p.id = :periodId', { periodId })
      .getOne();
    if (!period) throw notFound('Production period');
    await requireUnitRole(
      this.jobs.manager,
      context,
      period.unitId,
      PERIOD_WRITERS,
    );
    await this.enqueue(this.jobs.manager, {
      tenantId: period.tenantId,
      unitIds: [period.unitId],
      from: period.utcStart,
      to: period.utcEnd,
      trigger: 'manual_recompute',
      scopeUnitIds: [period.unitId],
      requestedBy: context.userId,
    });
    return this.jobs.findOneOrFail({
      where: { periodId, kind: 'recompute' },
      order: { createdAt: 'DESC' },
    });
  }

  async requestReportImport(
    context: RequestContext,
    csv: string,
  ): Promise<ActualsJob> {
    const tenantId = requireTenantId(context);
    assertTenantWide(context, 'An external production report');
    requireTenantRole(context, REPORT_IMPORTERS);
    return this.jobs.save(
      this.jobs.create({
        tenantId,
        kind: 'report_import',
        state: 'queued',
        request: {
          trigger: 'report_import',
          scopeUnitIds: periodScopeUnits(context),
          csv,
        },
        requestedBy: context.userId,
        createdBy: context.userId,
      }),
    );
  }

  /** Queues one recompute per period overlapping the window (existing queued jobs absorb repeats). */
  async enqueue(
    manager: EntityManager,
    window: RecomputeWindow,
  ): Promise<number> {
    const rows: unknown[] = await manager.query(
      `INSERT INTO "actuals_jobs" ("tenant_id", "row_version", "kind", "state", "period_id", "request", "requested_by", "created_by")
       SELECT p."tenant_id", 1, 'recompute', 'queued', p."id", $6::jsonb, $7, $7
         FROM "production_periods" p
        WHERE p."tenant_id" = $1 AND ($2::uuid[] IS NULL OR p."unit_id" = ANY($2::uuid[]))
          AND ($5::uuid[] IS NULL OR p."unit_id" = ANY($5::uuid[]))
          AND p."utc_end" > $3 AND p."utc_start" < COALESCE($4::timestamptz, now())
       ON CONFLICT ("period_id") WHERE "state" = 'queued' AND "kind" = 'recompute' DO NOTHING
       RETURNING "id"`,
      [
        window.tenantId,
        window.unitIds,
        window.from,
        window.to,
        window.scopeUnitIds,
        JSON.stringify({
          trigger: window.trigger,
          scopeUnitIds: window.scopeUnitIds,
        }),
        window.requestedBy,
      ],
    );
    return rows.length;
  }

  /** Queues recomputes for known periods (slices changed); repeats collapse into the queued job. */
  async enqueueIds(
    manager: EntityManager,
    tenantId: string,
    periodIds: readonly string[],
    trigger: string,
  ): Promise<number> {
    const rows: unknown[] = await manager.query(
      `INSERT INTO "actuals_jobs" ("tenant_id", "row_version", "kind", "state", "period_id", "request")
       SELECT $1, 1, 'recompute', 'queued', id, $3::jsonb FROM unnest($2::uuid[]) AS id
       ON CONFLICT ("period_id") WHERE "state" = 'queued' AND "kind" = 'recompute' DO NOTHING
       RETURNING "id"`,
      [tenantId, periodIds, JSON.stringify({ trigger, scopeUnitIds: null })],
    );
    return rows.length;
  }

  /** A job of the caller's tenant (and, for recomputes, of a period in its scope); 404 otherwise. */
  async get(context: RequestContext, jobId: string): Promise<ActualsJob> {
    const job = await scopedQuery(this.jobs, 'j', { context })
      .andWhere('j.id = :jobId', { jobId })
      .getOne();
    if (!job) throw notFound('Actuals job');
    if (job.periodId) {
      const period = await this.jobs.manager.findOneBy(ProductionPeriod, {
        id: job.periodId,
      });
      if (period)
        assertPeriodUnitInScope(context, period.unitId, 'Actuals job');
    } else if (periodScopeUnits(context)) {
      throw notFound('Actuals job');
    }
    return job;
  }

  async runPending(owner = runnerIdentity()): Promise<number> {
    let processed = 0;
    for (
      let id = await this.claimNext(owner);
      id;
      id = await this.claimNext(owner)
    ) {
      await this.process(id, owner);
      processed += 1;
    }
    return processed;
  }

  private async claimNext(owner: string): Promise<string | null> {
    const [rows]: [Array<{ id: string }>, number] = await this.jobs.query(
      `UPDATE "actuals_jobs" SET "state" = 'running', "lease_owner" = $1,
              "lease_expiry" = now() + make_interval(secs => $2), "attempts" = "attempts" + 1,
              "updated_at" = now(), "row_version" = "row_version" + 1
          WHERE "id" = (SELECT "id" FROM "actuals_jobs"
                         WHERE "state" = 'queued'
                            OR ("state" = 'running' AND ("lease_expiry" IS NULL OR "lease_expiry" < now()))
                         ORDER BY "created_at" LIMIT 1 FOR UPDATE SKIP LOCKED)
          RETURNING "id"`,
      [owner, envInt('ACTUALS_JOB_LEASE_SECONDS', 120)],
    );
    return rows[0]?.id ?? null;
  }

  private async process(jobId: string, owner: string): Promise<void> {
    const job = await this.jobs.findOneByOrFail({ id: jobId });
    let outcome: Outcome;
    try {
      outcome = await this.execute(job);
    } catch (error: unknown) {
      outcome = this.describe(jobId, error);
    }
    await this.jobs.query(
      `UPDATE "actuals_jobs" SET "state" = $3::actuals_job_state, "result" = $4::jsonb, "error_code" = $5,
              "error_message" = $6, "finished_at" = now(), "lease_owner" = NULL, "lease_expiry" = NULL,
              "updated_at" = now(), "row_version" = "row_version" + 1
        WHERE "id" = $1 AND "lease_owner" = $2`,
      [
        jobId,
        owner,
        outcome.state,
        outcome.state === 'completed' ? JSON.stringify(outcome.result) : null,
        outcome.state === 'failed' ? outcome.code : null,
        outcome.state === 'failed' ? outcome.message : null,
      ],
    );
  }

  private async execute(job: ActualsJob): Promise<Outcome> {
    if (job.kind === 'report_import') {
      const result = await this.reports.importCsv(
        { tenantId: job.tenantId, userId: job.requestedBy },
        job.request.csv ?? '',
      );
      return { state: 'completed', result: { ...result } };
    }
    const period = job.periodId
      ? await this.jobs.manager.findOneBy(ProductionPeriod, {
          id: job.periodId,
        })
      : null;
    if (!period)
      return {
        state: 'failed',
        code: 'NOT_FOUND',
        message: 'the period no longer exists',
      };
    if (!scopeCovers(job.request.scopeUnitIds, period.unitId)) {
      return {
        state: 'failed',
        code: 'UNIT_SCOPE',
        message: 'the period unit is outside the requester’s unit scope',
      };
    }
    await this.ensureSlices(period);
    const trigger = {
      reason: job.request.trigger,
      requestedBy: job.requestedBy,
    };
    // 2.5: the calculation run (actuals first, then the loss ledgers) when the accounting module is loaded
    const full = this.recompute.registered;
    const result = full
      ? await full(period.id, trigger)
      : { ...(await this.runner.run(period.id, trigger)) };
    return { state: 'completed', result };
  }

  /**
   * A period without an active slice (e.g. reopened by `revise`, which the materializer's re-resolution
   * skips) is re-resolved on the current setup before the run, so the recompute does not repeat an empty run.
   */
  private async ensureSlices(period: ProductionPeriod): Promise<void> {
    const active = await this.jobs.manager.exists(PeriodProductSlice, {
      where: { periodId: period.id, supersededAt: IsNull() },
    });
    if (active) return;
    await this.jobs.manager.transaction((manager) =>
      this.slices.resolve(manager, [period]),
    );
  }

  /** Error code and message for the job record; never SQL or stack traces. */
  private describe(jobId: string, error: unknown): Outcome {
    if (error instanceof HttpException) {
      const body = error.getResponse();
      const code =
        typeof body === 'object' && body !== null && 'code' in body
          ? String(body.code)
          : `HTTP_${error.getStatus()}`;
      return { state: 'failed', code, message: error.message };
    }
    this.logger.error(
      `Actuals job ${jobId} failed`,
      error instanceof Error ? error.stack : String(error),
    );
    return {
      state: 'failed',
      code: 'INTERNAL_ERROR',
      message: 'The actuals job failed',
    };
  }
}
