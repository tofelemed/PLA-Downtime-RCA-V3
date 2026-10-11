import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { enqueueOutbox } from '../../common/outbox/outbox-writer';
import { adapterErrorOf } from '../adapters/adapter-error';
import { AdapterRegistry } from '../adapters/adapter-registry';
import { IntegrationConnectionService } from '../connections/integration-connection.service';
import { IntegrationConnection } from '../entities/integration-connection.entity';
import { canonicalJson } from '../envelope/envelope-validator';
import { IngestionJob, JobCadence } from '../entities/ingestion-job.entity';
import { recordTransition, SUBSCRIBE_MODE } from './job-lease';
import { JobAction, nextJobState } from './job-transitions';

const UNIQUE_VIOLATION = '23505';
const DEFAULT_CADENCE: JobCadence = { intervalSeconds: 60, pageSize: 500 };

export interface NewIngestionJob {
  scope: Record<string, unknown>;
  cadence?: Partial<JobCadence>;
  start?: boolean;
}

/**
 * Job lifecycle commands (spec ING02, API04): create a job for a connection scope, and start / pause /
 * resume / drain / stop it. Each change locks the row, checks the transition table and appends an
 * audit row in the same transaction. At most one non-stopped job per connection and scope (409).
 */
@Injectable()
export class IngestionJobsService {
  constructor(
    @InjectRepository(IngestionJob)
    private readonly jobs: Repository<IngestionJob>,
    private readonly connections: IntegrationConnectionService,
    private readonly adapters: AdapterRegistry,
  ) {}

  async create(
    context: RequestContext,
    connectionId: string,
    input: NewIngestionJob,
  ): Promise<IngestionJob> {
    const connection = await this.connections.get(context, connectionId);
    await this.validateScope(connection, input.scope);
    const created = await this.unique(() =>
      this.jobs.manager.transaction(async (manager) => {
        if (isSubscribeScope(input.scope))
          await assertNoActiveSubscription(manager, connection.id);
        const job = await manager.save(
          manager.create(IngestionJob, {
            tenantId: connection.tenantId,
            connectionId: connection.id,
            scope: input.scope,
            scopeHash: scopeHash(input.scope),
            state: 'created',
            cadence: { ...DEFAULT_CADENCE, ...input.cadence },
            createdBy: context.userId,
            updatedBy: context.userId,
          }),
        );
        await this.audit(manager, job, {
          action: 'create',
          from: 'created',
          actorId: context.userId,
        });
        return job;
      }),
    );
    return input.start ? this.command(context, created.id, 'start') : created;
  }

  /** Applies a lifecycle command; 409 `INVALID_TRANSITION` when the state does not allow it. */
  async command(
    context: RequestContext,
    jobId: string,
    action: JobAction,
    reason?: string,
  ): Promise<IngestionJob> {
    const tenantId = requireTenantId(context);
    return this.unique(() =>
      this.jobs.manager.transaction(async (manager) => {
        const job = await this.lock(manager, tenantId, jobId);
        const target = nextJobState(job.state, action);
        if (!target) {
          throw new ConflictException({
            code: 'INVALID_TRANSITION',
            message: `Cannot ${action} a job in state ${job.state}`,
          });
        }
        const from = job.state;
        Object.assign(job, transitionFields(action, target), {
          updatedBy: context.userId,
        });
        const saved = await manager.save(job);
        if (action === 'start' || action === 'resume')
          await runNow(manager, saved);
        await this.audit(manager, saved, {
          action,
          from,
          actorId: context.userId,
          reason,
        });
        await announceJobChange(manager, saved, action);
        return saved;
      }),
    );
  }

  /** The adapter's scope check (plan 1.7); a scope that can never run is 422 `INVALID_JOB_SCOPE`. */
  private async validateScope(
    connection: IntegrationConnection,
    scope: Record<string, unknown>,
  ): Promise<void> {
    const adapter = this.adapters.find(connection.sourceType);
    try {
      await adapter?.validateScope?.(connection, scope);
    } catch (error) {
      const classified = adapterErrorOf(error);
      if (!classified || classified.retryable) throw error;
      throw new UnprocessableEntityException({
        code: 'INVALID_JOB_SCOPE',
        message: classified.message,
      });
    }
  }

  /** A job of the caller's tenant; 404 for foreign or unknown ids. */
  async get(context: RequestContext, jobId: string): Promise<IngestionJob> {
    const job = await this.jobs.findOneBy({
      id: jobId,
      tenantId: requireTenantId(context),
    });
    if (!job) throw notFound();
    return job;
  }

  private async lock(
    manager: EntityManager,
    tenantId: string,
    jobId: string,
  ): Promise<IngestionJob> {
    const job = await manager.findOne(IngestionJob, {
      where: { id: jobId, tenantId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!job) throw notFound();
    return job;
  }

  private audit(
    manager: EntityManager,
    job: IngestionJob,
    change: {
      action: string;
      from: string;
      actorId: string | null;
      reason?: string;
    },
  ): Promise<void> {
    return recordTransition(manager, {
      tenantId: job.tenantId,
      jobId: job.id,
      action: change.action,
      fromState: change.from,
      toState: job.state,
      actorId: change.actorId,
      runner: null,
      detail: change.reason ? { reason: change.reason } : null,
    });
  }

  /** 409 `JOB_SCOPE_EXISTS` when another non-stopped job has the same connection and scope. */
  private async unique<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      const code = (error as QueryFailedError & { code?: string }).code;
      if (error instanceof QueryFailedError && code === UNIQUE_VIOLATION) {
        throw new ConflictException({
          code: 'JOB_SCOPE_EXISTS',
          message: 'A job with this connection and scope is already active',
        });
      }
      throw error;
    }
  }
}

/** sha256 of the canonical scope JSON (key order does not matter). */
export function scopeHash(scope: Record<string, unknown>): string {
  return createHash('sha256').update(canonicalJson(scope)).digest('hex');
}

/** Starting also resets the retry budget; starting and resuming run the job now (`runNow`). */
function transitionFields(
  action: JobAction,
  target: IngestionJob['state'],
): Partial<IngestionJob> {
  if (action === 'start') {
    return { state: target, retryCount: 0, lastError: null };
  }
  return { state: target };
}

/** Whether a scope names a subscription hosted by the worker (plan 1.8), not a pull job. */
export function isSubscribeScope(scope: Record<string, unknown>): boolean {
  return scope.mode === SUBSCRIBE_MODE;
}

/** One subscription per connection whatever its topics: a second active one is 409 `JOB_SCOPE_EXISTS`. */
async function assertNoActiveSubscription(
  manager: EntityManager,
  connectionId: string,
): Promise<void> {
  const rows: Array<{ id: string }> = await manager.query(
    `SELECT "id" FROM "ingestion_jobs" WHERE "connection_id" = $1 AND "scope"->>'mode' = $2 AND "state" <> 'stopped' LIMIT 1`,
    [connectionId, SUBSCRIBE_MODE],
  );
  if (rows.length === 0) return;
  throw new ConflictException({
    code: 'JOB_SCOPE_EXISTS',
    message: 'A subscription job of this connection is already active',
  });
}

/**
 * Makes the job due by the database clock, the clock `claimDueJob` compares with: a time taken from the
 * application host could lie ahead of the database and leave the job not yet due. A subscription is
 * never due (`next_run_at` null): the subscriber host picks the state change up on its next reconcile.
 */
async function runNow(
  manager: EntityManager,
  job: IngestionJob,
): Promise<void> {
  const [rows]: [Array<{ next_run_at: Date | null }>, number] =
    await manager.query(
      `UPDATE "ingestion_jobs" SET "next_run_at" = CASE WHEN $2 THEN NULL ELSE now() END
        WHERE "id" = $1 RETURNING "next_run_at"`,
      [job.id, isSubscribeScope(job.scope)],
    );
  job.nextRunAt = rows[0]?.next_run_at ?? job.nextRunAt;
}

/** Lets the worker-side hosts react at once (plan 1.8 `MqttSubscriberHost`) instead of on the next sweep. */
function announceJobChange(
  manager: EntityManager,
  job: IngestionJob,
  action: JobAction,
): Promise<string[]> {
  return enqueueOutbox(manager, [
    {
      tenantId: job.tenantId,
      aggregateType: 'ingestion_job',
      aggregateId: job.id,
      type: 'IngestionJobChanged',
      payload: {
        jobId: job.id,
        connectionId: job.connectionId,
        action,
        state: job.state,
      },
      scope: job.connectionId,
    },
  ]);
}

function notFound(): NotFoundException {
  return new NotFoundException({
    code: 'NOT_FOUND',
    message: 'Ingestion job not found',
  });
}
