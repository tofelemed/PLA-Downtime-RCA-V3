import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash, Hash } from 'crypto';
import { once } from 'events';
import { DataSource } from 'typeorm';
import { envInt } from '../common/helpers/time-bounds';
import { CSV_BOM, csvRow } from './csv';
import { SliceProductLabel } from './entities/export-job-source.entity';
import { ExportJob } from './entities/export-job.entity';
import {
  headerRecords,
  RenderSource,
  REPORT_COLUMNS,
  reportRows,
  reviewedOf,
} from './export-report';
import { snapshotSelfApproved } from './export-self-approval';
import { ExportStorage, PendingObject } from './export-storage';
import { ExportPdfWriter, exportHeaderOf } from './pdf/export-pdf';

/** What the worker decides at each page checkpoint. */
export type Checkpoint = 'continue' | 'cancel' | 'lost';

export type RenderResult =
  | {
      status: 'completed';
      key: string;
      contentHash: string;
      sizeBytes: number;
      rowCount: number;
      processed: number;
    }
  | { status: 'cancel' | 'lost'; processed: number };

type Outcome = { status: Checkpoint; processed: number };
type CheckpointFn = (processed: number) => Promise<Checkpoint>;

interface SourceRow {
  position: number;
  period_id: string;
  unit_id: string;
  unit_name: string | null;
  revision_id: string;
  revision: number;
  snapshot_id: string;
  approved_at: Date;
  slice_products: Record<string, SliceProductLabel>;
  content: Record<string, unknown>;
  opener: string | null;
  bridge_reviewer: string | null;
}

/** Bytes written so far: size and sha256 are computed while streaming. */
class HashingWriter {
  readonly hash: Hash = createHash('sha256');
  size = 0;
  rows = 0;

  constructor(private readonly target: PendingObject) {}

  write(text: string): Promise<void> {
    return this.writeBytes(Buffer.from(text, 'utf8'));
  }

  async writeBytes(bytes: Buffer): Promise<void> {
    this.hash.update(bytes);
    this.size += bytes.length;
    if (!this.target.stream.write(bytes))
      await once(this.target.stream, 'drain');
  }
}

function toSource(row: SourceRow): RenderSource {
  const reviewed = reviewedOf(row.content);
  return {
    periodId: row.period_id,
    unitId: row.unit_id,
    unitName: row.unit_name,
    revisionId: row.revision_id,
    revision: Number(row.revision),
    snapshotId: row.snapshot_id,
    approvedAt: new Date(row.approved_at).toISOString(),
    sliceProducts: row.slice_products,
    reviewed,
    selfApproved: snapshotSelfApproved(row.content, reviewed, {
      opener: row.opener,
      bridgeReviewer: row.bridge_reviewer,
    }),
  };
}

/**
 * Renders an export job to CSV (plan 2.9, AN03, NFR02) or PDF (owner 15 Oct). CSV: a header block (scope,
 * filters, timezone, approved status, source count, valuation status), the column row, then the rows of
 * each pinned source in position order, read page by page from the immutable approval snapshots (never the
 * whole export in memory) and streamed to storage with backpressure while the sha256 is computed. PDF: the
 * same pinned sources (bounded at request time by `EXPORT_PDF_MAX_SOURCES`) are read with the same
 * checkpoints, laid out with the presentation pinned on the job and drawn by `ExportPdfWriter`. The bytes
 * depend only on the job and its pinned sources, so re-rendering a job reproduces the same hash. A
 * checkpoint after each page lets the worker stop (cancellation, lost lease); the partial file is removed.
 */
@Injectable()
export class ExportRenderer {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly storage: ExportStorage,
    private readonly pdf: ExportPdfWriter,
  ) {}

  async render(
    job: ExportJob,
    checkpoint: CheckpointFn,
  ): Promise<RenderResult> {
    const key = this.storage.keyOf(job.tenantId, job.id, job.format);
    const target = await this.storage.openWrite(key);
    try {
      const writer = new HashingWriter(target);
      const outcome = await this.write(writer, job, checkpoint);
      if (outcome.status !== 'continue') {
        await target.abort();
        return { status: outcome.status, processed: outcome.processed };
      }
      await target.commit();
      return {
        status: 'completed',
        key,
        contentHash: writer.hash.digest('hex'),
        sizeBytes: writer.size,
        rowCount: writer.rows,
        processed: outcome.processed,
      };
    } catch (error: unknown) {
      await target.abort();
      throw error;
    }
  }

  private write(
    writer: HashingWriter,
    job: ExportJob,
    checkpoint: CheckpointFn,
  ): Promise<Outcome> {
    if (job.reportType === 'rca_case')
      return this.writeCase(writer, job, checkpoint);
    return job.format === 'pdf'
      ? this.writePdf(writer, job, checkpoint)
      : this.writeCsv(writer, job, checkpoint);
  }

  /** Item 2.5: one case, drawn from the content pinned on the job; one checkpoint for the one source. */
  private async writeCase(
    writer: HashingWriter,
    job: ExportJob,
    checkpoint: CheckpointFn,
  ): Promise<Outcome> {
    const decision = await checkpoint(0);
    if (decision !== 'continue') return { status: decision, processed: 0 };
    writer.rows = await this.pdf.writeCase(job, {
      write: (chunk) => writer.writeBytes(chunk),
    });
    return { status: 'continue', processed: 1 };
  }

  private async writeCsv(
    writer: HashingWriter,
    job: ExportJob,
    checkpoint: CheckpointFn,
  ): Promise<Outcome> {
    const records = headerRecords(exportHeaderOf(job));
    await writer.write(CSV_BOM + records.map(csvRow).join('') + '\r\n');
    await writer.write(csvRow(REPORT_COLUMNS[job.reportType]));
    return this.eachSource(job, checkpoint, async (source) => {
      const rows = reportRows(job.reportType, source, job.labels);
      writer.rows += rows.length;
      await writer.write(rows.map(csvRow).join(''));
    });
  }

  /** PDF: every pinned source is read first (checkpointed), then the document is drawn in one pass. */
  private async writePdf(
    writer: HashingWriter,
    job: ExportJob,
    checkpoint: CheckpointFn,
  ): Promise<Outcome> {
    const sources: RenderSource[] = [];
    const outcome = await this.eachSource(job, checkpoint, (source) => {
      sources.push(source);
      return Promise.resolve();
    });
    if (outcome.status !== 'continue') return outcome;
    writer.rows = await this.pdf.write(job, sources, {
      write: (chunk) => writer.writeBytes(chunk),
    });
    return outcome;
  }

  /** The pinned sources in position order, page by page, with a checkpoint after each page. */
  private async eachSource(
    job: ExportJob,
    checkpoint: CheckpointFn,
    consume: (source: RenderSource) => Promise<void>,
  ): Promise<Outcome> {
    const pageSize = envInt('EXPORT_PAGE_SIZE', 200);
    let after = 0;
    let processed = 0;
    for (;;) {
      const page = await this.page(job.id, after, pageSize);
      if (page.length === 0) return { status: 'continue', processed };
      for (const row of page) await consume(toSource(row));
      processed += page.length;
      after = Number(page[page.length - 1].position);
      const decision = await checkpoint(processed);
      if (decision !== 'continue') return { status: decision, processed };
    }
  }

  private page(
    jobId: string,
    after: number,
    limit: number,
  ): Promise<SourceRow[]> {
    return this.dataSource.query(
      `SELECT s."position", s."period_id", s."unit_id", s."unit_name", s."revision_id", r."revision",
              s."snapshot_id", a."created_at" AS approved_at, s."slice_products", a."content",
              CASE WHEN r."supersedes_id" IS NOT NULL THEN r."created_by"::text END AS "opener",
              (SELECT b."actor_id"::text FROM "approval_actions" b
                WHERE b."revision_id" = s."revision_id" AND b."action" = 'bridge_review'
                  AND b."submitted_hash" = a."submitted_hash"
                ORDER BY b."created_at" DESC, b."id" DESC LIMIT 1) AS "bridge_reviewer"
         FROM "export_job_sources" s
         JOIN "accounting_revisions" r ON r."id" = s."revision_id"
         JOIN "approval_snapshots" a ON a."id" = s."snapshot_id"
        WHERE s."export_job_id" = $1 AND s."position" > $2
        ORDER BY s."position" LIMIT $3`,
      [jobId, after, limit],
    );
  }
}
