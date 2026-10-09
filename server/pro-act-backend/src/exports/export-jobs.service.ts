import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { envInt } from '../common/helpers/time-bounds';
import { runnerIdentity } from '../common/scheduling/runner-identity';
import { ExportJob } from './entities/export-job.entity';
import { Checkpoint, ExportRenderer, RenderResult } from './export-renderer';
import { ExportStorage } from './export-storage';

const HOUR_SECONDS = 3600;

/**
 * Worker side of export jobs (plan 2.9, API04): claims queued jobs (and running jobs whose lease expired)
 * with `FOR UPDATE SKIP LOCKED` under a lease, renders them, and finishes them under the same lease.
 * Each page checkpoint extends the lease, records progress (`processed`, `pending`) and honours a
 * cancellation request: the job becomes `cancelled` (with `partial` when sources had been rendered) and
 * keeps no file. A job is attempted at most EXPORT_JOB_MAX_ATTEMPTS times. Expired files are purged.
 */
@Injectable()
export class ExportJobsService {
  private readonly logger = new Logger(ExportJobsService.name);

  constructor(
    @InjectRepository(ExportJob) private readonly jobs: Repository<ExportJob>,
    private readonly renderer: ExportRenderer,
    private readonly storage: ExportStorage,
  ) {}

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

  /** Removes the files of expired exports (the job row and its sources stay as history). */
  async purgeExpired(limit = 100): Promise<number> {
    const rows: Array<{ id: string; object_key: string }> =
      await this.jobs.query(
        `SELECT "id", "object_key" FROM "export_jobs"
        WHERE "object_key" IS NOT NULL AND "expires_at" <= now() ORDER BY "expires_at" LIMIT $1`,
        [limit],
      );
    for (const row of rows) {
      await this.storage.remove(row.object_key);
      await this.jobs.query(
        `UPDATE "export_jobs" SET "object_key" = NULL, "updated_at" = now(), "row_version" = "row_version" + 1
          WHERE "id" = $1`,
        [row.id],
      );
    }
    return rows.length;
  }

  private async claimNext(owner: string): Promise<string | null> {
    const [rows]: [Array<{ id: string }>, number] = await this.jobs.query(
      `UPDATE "export_jobs" SET "state" = 'running', "lease_owner" = $1,
              "lease_expiry" = now() + make_interval(secs => $2), "attempts" = "attempts" + 1,
              "started_at" = COALESCE("started_at", now()), "updated_at" = now(), "row_version" = "row_version" + 1
        WHERE "id" = (SELECT "id" FROM "export_jobs"
                       WHERE "state" = 'queued'
                          OR ("state" = 'running' AND ("lease_expiry" IS NULL OR "lease_expiry" < now()))
                       ORDER BY "created_at" LIMIT 1 FOR UPDATE SKIP LOCKED)
        RETURNING "id"`,
      [owner, envInt('EXPORT_JOB_LEASE_SECONDS', 300)],
    );
    return rows[0]?.id ?? null;
  }

  private async process(jobId: string, owner: string): Promise<void> {
    const job = await this.jobs.findOneByOrFail({ id: jobId });
    if (job.attempts > envInt('EXPORT_JOB_MAX_ATTEMPTS', 3)) {
      await this.fail(
        job,
        owner,
        'ATTEMPTS_EXHAUSTED',
        'the export was attempted too often',
      );
      return;
    }
    try {
      const result = await this.renderer.render(job, (processed) =>
        this.checkpoint(job, owner, processed),
      );
      await this.finish(job, owner, result);
    } catch (error: unknown) {
      this.logger.error(
        `Export ${jobId} failed`,
        error instanceof Error ? error.stack : String(error),
      );
      await this.fail(
        job,
        owner,
        'RENDER_FAILED',
        'the export could not be rendered',
      );
    }
  }

  /** Extends the lease and records progress; tells the renderer to stop when cancelled or the lease is gone. */
  private async checkpoint(
    job: ExportJob,
    owner: string,
    processed: number,
  ): Promise<Checkpoint> {
    const [rows]: [Array<{ cancel_requested: boolean }>, number] =
      await this.jobs.query(
        `UPDATE "export_jobs"
          SET "lease_expiry" = now() + make_interval(secs => $3),
              "counts" = "counts" || jsonb_build_object('processed', $4::int, 'pending', $5::int),
              "updated_at" = now()
        WHERE "id" = $1 AND "lease_owner" = $2 AND "state" = 'running' RETURNING "cancel_requested"`,
        [
          job.id,
          owner,
          envInt('EXPORT_JOB_LEASE_SECONDS', 300),
          processed,
          Math.max(job.counts.accepted - processed, 0),
        ],
      );
    if (!rows[0]) return 'lost';
    return rows[0].cancel_requested ? 'cancel' : 'continue';
  }

  private async finish(
    job: ExportJob,
    owner: string,
    result: RenderResult,
  ): Promise<void> {
    if (result.status === 'lost') {
      this.logger.warn(`Export ${job.id}: lease lost, another worker owns it`);
      return;
    }
    if (
      result.status === 'completed' &&
      (await this.complete(job, owner, result))
    )
      return;
    if (result.status === 'completed') await this.storage.remove(result.key);
    await this.jobs.query(
      `UPDATE "export_jobs" SET "state" = 'cancelled', "partial" = $3, "object_key" = NULL,
              "counts" = "counts" || jsonb_build_object('processed', $4::int), "finished_at" = now(),
              "lease_owner" = NULL, "lease_expiry" = NULL, "updated_at" = now(), "row_version" = "row_version" + 1
        WHERE "id" = $1 AND "lease_owner" = $2`,
      [job.id, owner, result.processed > 0, result.processed],
    );
  }

  /** Completes the job unless a cancellation arrived meanwhile (then false, the caller cancels). */
  private async complete(
    job: ExportJob,
    owner: string,
    result: Extract<RenderResult, { status: 'completed' }>,
  ): Promise<boolean> {
    const [rows]: [unknown[], number] = await this.jobs.query(
      `UPDATE "export_jobs" SET "state" = 'completed', "object_key" = $3, "content_hash" = $4, "size_bytes" = $5,
              "row_count" = $6, "counts" = "counts" || jsonb_build_object('processed', $7::int, 'pending', 0),
              "generated_at" = now(), "expires_at" = now() + make_interval(secs => $8), "finished_at" = now(),
              "lease_owner" = NULL, "lease_expiry" = NULL, "updated_at" = now(), "row_version" = "row_version" + 1
        WHERE "id" = $1 AND "lease_owner" = $2 AND NOT "cancel_requested" RETURNING "id"`,
      [
        job.id,
        owner,
        result.key,
        result.contentHash,
        result.sizeBytes,
        result.rowCount,
        result.processed,
        envInt('EXPORT_TTL_HOURS', 168) * HOUR_SECONDS,
      ],
    );
    return rows.length > 0;
  }

  private async fail(
    job: ExportJob,
    owner: string,
    code: string,
    message: string,
  ): Promise<void> {
    await this.jobs.query(
      `UPDATE "export_jobs" SET "state" = 'failed', "error_code" = $3, "error_message" = $4, "finished_at" = now(),
              "lease_owner" = NULL, "lease_expiry" = NULL, "updated_at" = now(), "row_version" = "row_version" + 1
        WHERE "id" = $1 AND "lease_owner" = $2`,
      [job.id, owner, code, message],
    );
  }
}
