import { HttpException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  anonymousContext,
  RequestContext,
} from '../common/context/request-context';
import { scopedQuery } from '../common/query/scoped-query';
import { BulkCodeService } from './bulk-code.service';
import { BULK_CHUNK_SIZE, BulkCodeCommand } from './bulk-code.types';
import { BulkJob, BulkJobChunk, BulkJobState } from './bulk-job.entity';
import { notFound } from './operation-support';

/** Stored payload of a `bulk_code` job: the validated command plus who asked for it. */
type BulkCodePayload = BulkCodeCommand & { actorId: string | null };

/**
 * API04 jobs of plan 1.4: status reads in the caller's tenant, and the worker side (claim a queued job
 * with `FOR UPDATE SKIP LOCKED`, apply it in atomic chunks of 200, record each chunk's outcome, finish
 * as `completed`, `partial` or `failed`).
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

  /** Processes queued jobs until none is left; returns how many ran. */
  async runPending(): Promise<number> {
    let processed = 0;
    for (let job = await this.claimNext(); job; job = await this.claimNext()) {
      await this.process(job);
      processed += 1;
    }
    return processed;
  }

  private async claimNext(): Promise<BulkJob | null> {
    // UPDATE ... RETURNING answers [rows, rowCount] through TypeORM's postgres driver
    const [rows]: [Array<{ id: string }>, number] = await this.jobs.query(
      `UPDATE "bulk_jobs" SET "state" = 'running', "updated_at" = now(), "row_version" = "row_version" + 1
          WHERE "id" = (SELECT "id" FROM "bulk_jobs" WHERE "state" = 'queued'
                         ORDER BY "created_at" LIMIT 1 FOR UPDATE SKIP LOCKED)
          RETURNING "id"`,
    );
    const claimed = rows[0];
    return claimed ? this.jobs.findOneBy({ id: claimed.id }) : null;
  }

  private async process(job: BulkJob): Promise<void> {
    const payload = job.payload as unknown as BulkCodePayload;
    const context = jobContext(job, payload.actorId);
    const chunks: BulkJobChunk[] = [];
    let processed = 0;
    let failed = 0;
    for (
      let start = 0;
      start < payload.items.length;
      start += BULK_CHUNK_SIZE
    ) {
      const items = payload.items.slice(start, start + BULK_CHUNK_SIZE);
      const chunk = await this.applyChunk(context, { ...payload, items });
      chunks.push({ ...chunk, index: chunks.length });
      if (chunk.state === 'completed') processed += items.length;
      else failed += items.length;
      await this.jobs.update(job.id, { chunks, processed, failed });
    }
    await this.jobs.update(job.id, {
      state: finalState(processed, failed),
      finishedAt: new Date(),
    });
  }

  private async applyChunk(
    context: RequestContext,
    command: BulkCodeCommand,
  ): Promise<Omit<BulkJobChunk, 'index'>> {
    const size = command.items.length;
    try {
      await this.bulkCode.apply(context, command);
      return { size, state: 'completed' };
    } catch (error) {
      return { size, state: 'failed', ...this.describe(error) };
    }
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
