import {
  ConflictException,
  GoneException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ReadStream } from 'fs';
import { Repository } from 'typeorm';
import { appendAudit } from '../common/audit/audit-trail';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { restrictedUnitIds, scopedQuery } from '../common/query/scoped-query';
import { notFound } from '../profiles/profile-errors';
import { ExportJob } from './entities/export-job.entity';
import { canSeeExport } from './export-scope';
import { ExportStorage } from './export-storage';

/** One pinned source as listed by `GET /exports/{id}/sources`. */
export interface ExportSourceRow {
  position: number;
  periodId: string;
  unitId: string;
  revisionId: string;
  revision: number;
  snapshotId: string;
  snapshotHash: string;
  calculationRunId: string | null;
}

export interface ExportDownload {
  job: ExportJob;
  stream: ReadStream;
}

function gone(code: string, message: string): GoneException {
  return new GoneException({ code, message });
}

/**
 * Reads of export jobs (plan 2.9): status, list, the pinned sources and the download. Every path id is
 * tenant- and unit-scoped (404 otherwise, no existence leak, `canSeeExport`); a download is authorized
 * again when it happens, needs a completed, unexpired job and is audited.
 */
@Injectable()
export class ExportReadsService {
  private readonly logger = new Logger(ExportReadsService.name);

  constructor(
    @InjectRepository(ExportJob) private readonly jobs: Repository<ExportJob>,
    private readonly storage: ExportStorage,
  ) {}

  async get(context: RequestContext, id: string): Promise<ExportJob> {
    const job = await scopedQuery(this.jobs, 'j', { context })
      .andWhere('j.id = :id', { id })
      .getOne();
    if (!job || !canSeeExport(context, job)) throw notFound('Export job');
    return job;
  }

  /** Jobs the caller may see, newest first (keyset on `created_at, id`). */
  list(context: RequestContext) {
    const qb = scopedQuery(this.jobs, 'j', { context });
    const allowed = restrictedUnitIds(context, requireTenantId(context));
    if (allowed) {
      qb.andWhere(
        'j.unitIds IS NOT NULL AND j.unitIds <@ CAST(:allowed AS uuid[])',
        { allowed },
      );
    }
    return qb;
  }

  async sources(
    context: RequestContext,
    id: string,
    page: { after: number; limit: number },
  ): Promise<ExportSourceRow[]> {
    const job = await this.get(context, id);
    const rows: Array<{
      position: number;
      period_id: string;
      unit_id: string;
      revision_id: string;
      revision: number;
      snapshot_id: string;
      content_hash: string;
      run_id: string | null;
    }> = await this.jobs.query(
      `SELECT s."position", s."period_id", s."unit_id", s."revision_id", r."revision", s."snapshot_id",
              a."content_hash", a."content"->'reviewed'->'run'->>'id' AS run_id
         FROM "export_job_sources" s
         JOIN "accounting_revisions" r ON r."id" = s."revision_id"
         JOIN "approval_snapshots" a ON a."id" = s."snapshot_id"
        WHERE s."export_job_id" = $1 AND s."position" > $2 ORDER BY s."position" LIMIT $3`,
      [job.id, page.after, page.limit],
    );
    return rows.map((row) => ({
      position: Number(row.position),
      periodId: row.period_id,
      unitId: row.unit_id,
      revisionId: row.revision_id,
      revision: Number(row.revision),
      snapshotId: row.snapshot_id,
      snapshotHash: row.content_hash,
      calculationRunId: row.run_id,
    }));
  }

  /**
   * The file of a completed job, re-authorized now: 404 outside the caller's tenant or scope, 409 while
   * queued or running, 410 when cancelled, failed or expired. Counts and audits the download.
   */
  async download(context: RequestContext, id: string): Promise<ExportDownload> {
    const job = await this.get(context, id);
    const key = this.availableKey(job);
    if (!(await this.storage.exists(key))) {
      this.logger.error(`Export ${job.id}: file ${key} is missing`);
      throw gone('EXPORT_EXPIRED', 'the export file is no longer available');
    }
    await this.jobs.manager.transaction(async (manager) => {
      await manager.increment(ExportJob, { id: job.id }, 'downloadCount', 1);
      await appendAudit(manager, [
        {
          tenantId: job.tenantId,
          actorId: context.userId,
          action: 'export.downloaded',
          entityType: 'export_job',
          entityId: job.id,
          afterHash: job.contentHash,
          correlationId: context.correlationId,
        },
      ]);
    });
    return { job, stream: this.storage.openRead(key) };
  }

  private availableKey(job: ExportJob): string {
    if (job.state === 'queued' || job.state === 'running') {
      throw new ConflictException({
        code: 'EXPORT_NOT_READY',
        message: `the export is ${job.state}`,
      });
    }
    if (job.state === 'cancelled') {
      throw gone('EXPORT_CANCELLED', 'a cancelled export has no file');
    }
    if (job.state === 'failed') {
      throw gone('EXPORT_FAILED', 'the export failed and has no file');
    }
    const expired =
      job.expiresAt !== null && job.expiresAt.getTime() <= Date.now();
    if (expired || !job.objectKey) {
      throw gone('EXPORT_EXPIRED', 'the export file has expired');
    }
    return job.objectKey;
  }
}
