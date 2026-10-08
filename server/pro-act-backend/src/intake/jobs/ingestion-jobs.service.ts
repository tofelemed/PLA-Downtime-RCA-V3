import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { IntegrationConnectionService } from '../connections/integration-connection.service';
import { canonicalJson } from '../envelope/envelope-validator';
import { IngestionJob, JobCadence } from '../entities/ingestion-job.entity';
import { recordTransition } from './job-lease';
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
  ) {}

  async create(
    context: RequestContext,
    connectionId: string,
    input: NewIngestionJob,
  ): Promise<IngestionJob> {
    const connection = await this.connections.get(context, connectionId);
    const created = await this.unique(() =>
      this.jobs.manager.transaction(async (manager) => {
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
        await this.audit(manager, saved, {
          action,
          from,
          actorId: context.userId,
          reason,
        });
        return saved;
      }),
    );
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

/** Starting or resuming runs the job now; starting also resets the retry budget. */
function transitionFields(
  action: JobAction,
  target: IngestionJob['state'],
): Partial<IngestionJob> {
  if (action === 'start') {
    return {
      state: target,
      nextRunAt: new Date(),
      retryCount: 0,
      lastError: null,
    };
  }
  if (action === 'resume') return { state: target, nextRunAt: new Date() };
  return { state: target };
}

function notFound(): NotFoundException {
  return new NotFoundException({
    code: 'NOT_FOUND',
    message: 'Ingestion job not found',
  });
}
