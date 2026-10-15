import { createHash } from 'crypto';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import * as request from 'supertest';
import { CSV_BOM } from '../../../src/exports/csv';
import { ExportJobsService } from '../../../src/exports/export-jobs.service';
import { DAY1 } from './plan-world';
import { NEXT_DAY } from './actuals-world';
import {
  ReconciliationBody,
  ReconciliationWorld,
} from './reconciliation-world';
import { bearer } from './test-app';

export interface ExportBody {
  id: string;
  format: string;
  presentation: Record<string, unknown> | null;
  state: string;
  status: string;
  unitIds: string[] | null;
  counts: {
    accepted: number;
    processed: number;
    quarantined: number;
    rejected: number;
    pending: number;
  };
  partial: boolean;
  rowCount: number | null;
  contentHash: string | null;
  downloadUrl: string | null;
  downloadCount: number;
  error: { code: string } | null;
}

export interface CsvFile {
  status: number;
  text: string;
  hash: string;
  header: string | undefined;
  body: { code?: string };
}

/**
 * World of the plan 2.9 integration specs: the 2.8 reconciliation world plus a temporary export storage
 * directory (removed by `stop`), a helper that approves a period's draft (every candidate rejected, one
 * manual line closing the gap), and helpers for export requests, the worker and downloads. Test data only.
 */
export class ExportWorld extends ReconciliationWorld {
  storageDir = '';
  private previousStorage: string | undefined;

  async start(): Promise<void> {
    this.previousStorage = process.env.EXPORT_STORAGE_DIR;
    this.storageDir = mkdtempSync(join(tmpdir(), 'proact-export-it-'));
    process.env.EXPORT_STORAGE_DIR = this.storageDir;
    await super.start();
  }

  async stop(): Promise<void> {
    await super.stop();
    rmSync(this.storageDir, { recursive: true, force: true });
    if (this.previousStorage === undefined)
      delete process.env.EXPORT_STORAGE_DIR;
    else process.env.EXPORT_STORAGE_DIR = this.previousStorage;
  }

  /** Closes the draft of `periodId` with one manual line of the gap, submits (admin) and approves (approver). */
  async approvePeriod(
    periodId: string,
    reasonCodeId: string,
    reason = 'feed outage',
  ): Promise<ReconciliationBody> {
    const draft = await this.view(periodId);
    const lines = this.rejectAllPlus(
      draft,
      draft.slices[0].gap ?? '0',
      reasonCodeId,
    ).map((line) => (line.action === 'manual' ? { ...line, reason } : line));
    await this.saveLines(draft, lines, this.admin, periodId).expect(200);
    await this.submit(await this.view(periodId), this.admin, periodId).expect(
      200,
    );
    await this.approve(
      await this.view(periodId),
      this.approver,
      periodId,
    ).expect(200);
    return this.view(periodId);
  }

  requestExport(
    body: Record<string, unknown>,
    token = this.admin,
  ): request.Test {
    return this.post('exports', body, token);
  }

  /** A `published` export of day 1 (202) and its job id. */
  async exportDay(
    extra: Record<string, unknown> = {},
    token = this.admin,
  ): Promise<string> {
    const response = await this.requestExport(
      {
        reportType: 'period_summary',
        format: 'csv',
        revisionSelector: 'published',
        from: DAY1,
        to: NEXT_DAY,
        unitIds: [this.world.unitA1],
        ...extra,
      },
      token,
    ).expect(202);
    const body = response.body as { jobId: string; statusUrl: string };
    expect(body.statusUrl).toBe(`/api/v2/exports/${body.jobId}`);
    return body.jobId;
  }

  runExports(): Promise<number> {
    return this.app.get(ExportJobsService).runPending();
  }

  async exportJob(id: string, token = this.admin): Promise<ExportBody> {
    return (await this.get(`exports/${id}`, token).expect(200))
      .body as ExportBody;
  }

  async download(id: string, token = this.admin): Promise<CsvFile> {
    const response = await this.http()
      .get(`/api/v2/exports/${id}/download`)
      .set(bearer(token))
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      });
    const bytes = response.body as Buffer;
    const text = bytes.toString('utf8');
    let body: { code?: string } = {};
    if (response.status !== 200) body = JSON.parse(text) as { code?: string };
    return {
      status: response.status,
      text,
      hash: createHash('sha256').update(bytes).digest('hex'),
      header: response.headers['x-content-sha256'],
      body,
    };
  }

  /** Data rows of a CSV as column → cell maps (header block and column row skipped). */
  static records(text: string): Array<Record<string, string>> {
    const [, table] = text.replace(CSV_BOM, '').split('\r\n\r\n');
    const [columns, ...rows] = table
      .split('\r\n')
      .filter((line) => line.length > 0);
    const names = columns.split(',');
    return rows.map((row) => {
      const cells = splitCsv(row);
      return Object.fromEntries(names.map((name, i) => [name, cells[i]]));
    });
  }
}

/** Minimal RFC 4180 split of one record (quoted fields, doubled quotes). */
function splitCsv(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted && char === '"' && line[i + 1] === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}
