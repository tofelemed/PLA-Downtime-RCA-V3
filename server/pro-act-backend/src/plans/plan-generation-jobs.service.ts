import { HttpException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestContext } from '../common/context/request-context';
import { envInt } from '../common/helpers/time-bounds';
import { scopedQuery } from '../common/query/scoped-query';
import { runnerIdentity } from '../common/scheduling/runner-identity';
import { Distribution } from '../domain/plans/plan.types';
import {
  GenerationJobResult,
  PlanGenerationJob,
} from './entities/plan-generation-job.entity';
import { PlanVersion } from './entities/plan-version.entity';
import { conflict, notFound } from './plan-errors';
import { PlanPeriodGeneratorService } from './plan-period-generator.service';
import { scopeCovers, scopeUnitIds } from './plan-scope';
import { PlanVersionsService } from './plan-versions.service';

type Outcome =
  | { state: 'completed'; result: GenerationJobResult }
  | { state: 'failed'; code: string; message: string };

/**
 * Persisted period generation as a job (plan 2.3, API04: 202 + job). The request checks the plan in the
 * caller's scope and records the caller's unit scope with the job; the worker claims jobs under a lease
 * (`FOR UPDATE SKIP LOCKED`, reclaimed after PLAN_GENERATION_LEASE_SECONDS), re-checks that the version's
 * unit is still inside the recorded scope (a unit-limited requester never makes the job write another
 * unit's plan) and regenerates the open version's periods in one transaction.
 */
@Injectable()
export class PlanGenerationJobsService {
  private readonly logger = new Logger(PlanGenerationJobsService.name);

  constructor(
    @InjectRepository(PlanGenerationJob)
    private readonly jobs: Repository<PlanGenerationJob>,
    private readonly plans: PlanVersionsService,
    private readonly generator: PlanPeriodGeneratorService,
  ) {}

  async request(
    context: RequestContext,
    planId: string,
    body: { version: number; distribution?: Distribution },
  ): Promise<PlanGenerationJob> {
    const version = await this.plans.getVersion(context, planId, body.version);
    if (
      version.approvalState !== 'draft' &&
      version.approvalState !== 'submitted'
    ) {
      throw conflict(
        'VERSION_NOT_DRAFT',
        'periods of an approved plan version are frozen; create a new version',
      );
    }
    return this.jobs.save(
      this.jobs.create({
        tenantId: version.tenantId,
        planId,
        planVersionId: version.id,
        state: 'queued',
        request: {
          version: version.version,
          distribution: body.distribution ?? null,
          scopeUnitIds: scopeUnitIds(context),
        },
        requestedBy: context.userId,
        createdBy: context.userId,
        updatedBy: context.userId,
      }),
    );
  }

  /** A job of the caller's tenant whose plan the caller may see; 404 otherwise. */
  async get(
    context: RequestContext,
    jobId: string,
  ): Promise<PlanGenerationJob> {
    const job = await scopedQuery(this.jobs, 'j', { context })
      .andWhere('j.id = :jobId', { jobId })
      .getOne();
    if (!job) throw notFound('Generation job');
    await this.plans.getPlan(context, job.planId).catch(() => {
      throw notFound('Generation job');
    });
    return job;
  }

  /** Processes queued (or abandoned) jobs until none is left; returns how many ran. */
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
    // UPDATE ... RETURNING answers [rows, rowCount] through TypeORM's postgres driver
    const [rows]: [Array<{ id: string }>, number] = await this.jobs.query(
      `UPDATE "plan_generation_jobs" SET "state" = 'running', "lease_owner" = $1,
              "lease_expiry" = now() + make_interval(secs => $2), "attempts" = "attempts" + 1,
              "updated_at" = now(), "row_version" = "row_version" + 1
          WHERE "id" = (SELECT "id" FROM "plan_generation_jobs"
                         WHERE "state" = 'queued'
                            OR ("state" = 'running' AND ("lease_expiry" IS NULL OR "lease_expiry" < now()))
                         ORDER BY "created_at" LIMIT 1 FOR UPDATE SKIP LOCKED)
          RETURNING "id"`,
      [owner, leaseSeconds()],
    );
    return rows[0]?.id ?? null;
  }

  private async process(jobId: string, owner: string): Promise<void> {
    const job = await this.jobs.findOneByOrFail({ id: jobId });
    let outcome: Outcome;
    try {
      outcome = await this.jobs.manager.transaction(async (manager) => {
        const version = await manager.findOneByOrFail(PlanVersion, {
          id: job.planVersionId,
        });
        if (!scopeCovers(job.request.scopeUnitIds, version.unitId)) {
          return refused(
            'UNIT_SCOPE',
            'the plan unit is outside the requester’s unit scope',
          );
        }
        const result = await this.generator.regenerate(
          manager,
          version.id,
          job.request.distribution,
        );
        return {
          state: 'completed' as const,
          result: {
            periods: result.periods.length,
            headerTarget: result.headerTarget,
            totals: result.totals,
            warnings: result.warnings,
          },
        };
      });
    } catch (error: unknown) {
      outcome = this.describe(jobId, error);
    }
    await this.finish(jobId, owner, outcome);
  }

  private async finish(
    jobId: string,
    owner: string,
    outcome: Outcome,
  ): Promise<void> {
    const failed = outcome.state === 'failed';
    await this.jobs.query(
      `UPDATE "plan_generation_jobs" SET "state" = $3::plan_generation_job_state, "result" = $4::jsonb,
              "error_code" = $5, "error_message" = $6, "finished_at" = now(), "lease_owner" = NULL,
              "lease_expiry" = NULL, "updated_at" = now(), "row_version" = "row_version" + 1
        WHERE "id" = $1 AND "lease_owner" = $2`,
      [
        jobId,
        owner,
        outcome.state,
        failed ? null : JSON.stringify(outcome.result),
        failed ? outcome.code : null,
        failed ? outcome.message : null,
      ],
    );
  }

  /** Error code and message for the job record; never SQL or stack traces. */
  private describe(jobId: string, error: unknown): Outcome {
    if (error instanceof HttpException) {
      const body = error.getResponse();
      const code =
        typeof body === 'object' && body !== null && 'code' in body
          ? String((body as { code: unknown }).code)
          : `HTTP_${error.getStatus()}`;
      return refused(code, error.message);
    }
    this.logger.error(
      `Plan generation job ${jobId} failed`,
      error instanceof Error ? error.stack : String(error),
    );
    return refused('INTERNAL_ERROR', 'The generation failed');
  }
}

function refused(code: string, message: string): Outcome {
  return { state: 'failed', code, message };
}

function leaseSeconds(): number {
  return envInt('PLAN_GENERATION_LEASE_SECONDS', 120);
}
