import { HttpException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  anonymousContext,
  RequestContext,
} from '../common/context/request-context';
import { envInt } from '../common/helpers/time-bounds';
import { scopedQuery } from '../common/query/scoped-query';
import { runnerIdentity } from '../common/scheduling/runner-identity';
import { BulkCodeService } from './bulk-code.service';
import { BULK_CHUNK_SIZE, BulkCodeCommand } from './bulk-code.types';
import { BulkJob, BulkJobChunk, BulkJobState } from './bulk-job.entity';
import { notFound } from './operation-support';

/** Stored payload of a `bulk_code` job: the validated command plus who asked for it. */
type BulkCodePayload = BulkCodeCommand & { actorId: string | null };

/**
 * API04 jobs of plan 1.4: status reads in the caller's tenant, and the worker side (claim a queued job
 * with `FOR UPDATE SKIP LOCKED` under a lease, apply it in atomic chunks of 200 with each chunk's record
 * and lease heartbeat in the chunk's transaction, finish as `completed`, `partial` or `failed`). A job
 * whose worker died is reclaimed after BULK_JOB_LEASE_SECONDS and continues after its last chunk.
 */
@Injectable()
export class BulkJobService {
  private readonly logger = new Logger(BulkJobService.name);

  constructor(
    @InjectRepository(BulkJob) private readonly jobs: Repository<BulkJob>,
    private readonly bulkCode: BulkCodeService,
  ) {}

  /** A job of the caller's tenant; 404 for foreign or unknown ids. */
  async get(context: RequestContext, jobId: string): Promise<BulkJob> {
    const job = await scopedQuery(this.jobs, 'job', { context })
      .andWhere('job.id = :jobId', { jobId })
      .getOne();
    if (!job) throw notFound();
    return job;
  }

  /** Processes queued (or abandoned) jobs until none is left; returns how many ran. */
  async runPending(owner = runnerIdentity()): Promise<number> {
    let processed = 0;
    for (
      let job = await this.claimNext(owner);
      job;
      job = await this.claimNext(owner)
    ) {
      await this.process(job, owner);
      processed += 1;
    }
    return processed;
  }

  /**
   * Claims the oldest queued job, or a `running` job whose lease expired (its worker died: plan 1.5
   * lease), with `FOR UPDATE SKIP LOCKED` so two workers never take the same job.
   */
  private async claimNext(owner: string): Promise<BulkJob | null> {
    // UPDATE ... RETURNING answers [rows, rowCount] through TypeORM's postgres driver
    const [rows]: [Array<{ id: string }>, number] = await this.jobs.query(
      `UPDATE "bulk_jobs" SET "state" = 'running', "lease_owner" = $1,
              "lease_expiry" = now() + make_interval(secs => $2), "attempts" = "attempts" + 1,
              "updated_at" = now(), "row_version" = "row_version" + 1
          WHERE "id" = (SELECT "id" FROM "bulk_jobs"
                         WHERE "state" = 'queued'
                            OR ("state" = 'running' AND ("lease_expiry" IS NULL OR "lease_expiry" < now()))
                         ORDER BY "created_at" LIMIT 1 FOR UPDATE SKIP LOCKED)
          RETURNING "id"`,
      [owner, leaseSeconds()],
    );
    const claimed = rows[0];
    return claimed ? this.jobs.findOneBy({ id: claimed.id }) : null;
  }

  /** Continues after the last recorded chunk, so a reclaimed job never re-applies a chunk. */
  private async process(job: BulkJob, owner: string): Promise<void> {
    const payload = job.payload as unknown as BulkCodePayload;
    const context = jobContext(job, payload.actorId);
    const lease: JobLease = { jobId: job.id, owner };
    let progress: Progress = {
      chunks: [...job.chunks],
      processed: job.processed,
      failed: job.failed,
    };
    try {
      for (
        let start = progress.chunks.length * BULK_CHUNK_SIZE;
        start < payload.items.length;
        start += BULK_CHUNK_SIZE
      ) {
        const items = payload.items.slice(start, start + BULK_CHUNK_SIZE);
        progress = await this.runChunk(lease, context, {
          command: { ...payload, items },
          progress,
        });
      }
      await this.finish(lease, progress);
    } catch (error) {
      if (!(error instanceof LeaseLostError)) throw error;
      this.logger.warn(
        `Bulk job ${job.id}: lease lost, another worker continues`,
      );
    }
  }

  /** Applies one chunk and records it in the same transaction; a failed chunk is recorded on its own. */
  private async runChunk(
    lease: JobLease,
    context: RequestContext,
    step: { command: BulkCodeCommand; progress: Progress },
  ): Promise<Progress> {
    const size = step.command.items.length;
    const index = step.progress.chunks.length;
    const done = withChunk(step.progress, { index, size, state: 'completed' });
    try {
      await this.bulkCode.apply(context, step.command, (manager) =>
        recordChunk(manager, lease, done),
      );
      return done;
    } catch (error) {
      if (error instanceof LeaseLostError) throw error;
      const failed = withChunk(step.progress, {
        index,
        size,
        state: 'failed',
        ...this.describe(error),
      });
      await recordChunk(this.jobs.manager, lease, failed);
      return failed;
    }
  }

  private async finish(lease: JobLease, progress: Progress): Promise<void> {
    await this.jobs.query(
      `UPDATE "bulk_jobs" SET "state" = $3::bulk_job_state, "finished_at" = now(), "lease_owner" = NULL,
              "lease_expiry" = NULL, "updated_at" = now(), "row_version" = "row_version" + 1
        WHERE "id" = $1 AND "lease_owner" = $2`,
      [
        lease.jobId,
        lease.owner,
        finalState(progress.processed, progress.failed),
      ],
    );
  }

  /** Error code and message for the chunk record; never SQL or stack traces. */
  private describe(error: unknown): {
    errorCode: string;
    errorMessage: string;
  } {
    if (error instanceof HttpException) {
      const body = error.getResponse();
      const code =
        typeof body === 'object' && body !== null && 'code' in body
          ? String((body as { code: unknown }).code)
          : `HTTP_${error.getStatus()}`;
      return { errorCode: code, errorMessage: error.message };
    }
    this.logger.error(
      'Bulk job chunk failed',
      error instanceof Error ? error.stack : String(error),
    );
    return { errorCode: 'INTERNAL_ERROR', errorMessage: 'The chunk failed' };
  }
}

interface JobLease {
  jobId: string;
  owner: string;
}

interface Progress {
  chunks: BulkJobChunk[];
  processed: number;
  failed: number;
}

/** The worker no longer holds the job (its lease expired and another worker claimed it). */
class LeaseLostError extends Error {}

function leaseSeconds(): number {
  return envInt('BULK_JOB_LEASE_SECONDS', 120);
}

function withChunk(progress: Progress, chunk: BulkJobChunk): Progress {
  return {
    chunks: [...progress.chunks, chunk],
    processed:
      progress.processed + (chunk.state === 'completed' ? chunk.size : 0),
    failed: progress.failed + (chunk.state === 'failed' ? chunk.size : 0),
  };
}

/** Writes the progress and extends the lease (heartbeat); throws when the lease is no longer ours. */
async function recordChunk(
  manager: EntityManager,
  lease: JobLease,
  progress: Progress,
): Promise<void> {
  const [rows]: [unknown[], number] = await manager.query(
    `UPDATE "bulk_jobs" SET "chunks" = $3::jsonb, "processed" = $4, "failed" = $5,
            "lease_expiry" = now() + make_interval(secs => $6), "updated_at" = now()
      WHERE "id" = $1 AND "lease_owner" = $2 RETURNING "id"`,
    [
      lease.jobId,
      lease.owner,
      JSON.stringify(progress.chunks),
      progress.processed,
      progress.failed,
      leaseSeconds(),
    ],
  );
  if (rows.length === 0) throw new LeaseLostError();
}

function finalState(processed: number, failed: number): BulkJobState {
  if (failed === 0) return 'completed';
  return processed === 0 ? 'failed' : 'partial';
}

/** The job runs as its requester inside its tenant (scope was checked when it was accepted). */
function jobContext(job: BulkJob, actorId: string | null): RequestContext {
  return {
    ...anonymousContext(`bulk-job:${job.id}`),
    userId: actorId,
    tenantId: job.tenantId,
  };
}
