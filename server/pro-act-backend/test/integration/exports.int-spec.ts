import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { CSV_BOM } from '../../src/exports/csv';
import { ExportJob } from '../../src/exports/entities/export-job.entity';
import { ExportJobsService } from '../../src/exports/export-jobs.service';
import { ExportRenderer } from '../../src/exports/export-renderer';
import { NEXT_DAY } from './support/actuals-world';
import { ApiError, DAY1 } from './support/plan-world';
import { ExportWorld } from './support/export-world';

/**
 * Plan 2.9 exports on real Postgres (AN03, API04, NFR02, T39 export half): a CSV bound to the approved
 * revisions pinned at request time (a later revise + approval does not change it; re-rendering reproduces
 * the hash), injection-safe cells, decimals as strings, header with status and sources, API04 counts,
 * cancellation (queued and mid-run with `partial`), 410 for cancelled and expired files, immutability.
 */
describe('report exports (plan 2.9)', () => {
  const env = new ExportWorld();
  let reason = '';

  beforeAll(async () => {
    await env.start();
    reason = await env.reasonCode('FEED');
    await env.rows(`UPDATE products SET name = $2 WHERE id = $1`, [
      env.products.p1,
      '=HYPERLINK("http://evil.example","x")',
    ]);
    await env.approvePeriod(env.periodA1, reason, '@SUM(1+1)*cmd|calc');
    await env.approvePeriod(env.periodB1, reason);
  });
  afterAll(() => env.stop());

  it('exports the published revisions as CSV: approved status, run ids, decimal strings, sanitized text, hash', async () => {
    const jobId = await env.exportDay();
    const queued = await env.exportJob(jobId);
    expect(queued).toMatchObject({
      state: 'queued',
      status: 'approved',
      downloadUrl: null,
    });
    expect(queued.counts).toEqual({
      accepted: 2,
      processed: 0,
      quarantined: 0,
      rejected: 0,
      pending: 2,
    });
    expect((await env.download(jobId)).status).toBe(409);

    expect(await env.runExports()).toBe(1);
    const done = await env.exportJob(jobId);
    expect(done).toMatchObject({
      state: 'completed',
      rowCount: 2,
      partial: false,
    });
    expect(done.counts.processed + done.counts.quarantined).toBe(
      done.counts.accepted,
    );
    expect(done.downloadUrl).toBe(`/api/v2/exports/${jobId}/download`);

    const file = await env.download(jobId);
    expect(file.status).toBe(200);
    expect(file.hash).toBe(done.contentHash);
    expect(file.header).toBe(done.contentHash);
    expect(file.text).toContain('status,approved\r\n');
    expect(file.text).toContain('source_revisions,2\r\n');
    const [first] = ExportWorld.records(file.text);
    const approved = await env.view(env.periodA1);
    expect(first).toMatchObject({
      period_id: env.periodA1,
      revision_id: approved.revision.id,
      revision: '1',
      calculation_run_id: approved.revision.currentRunId,
      target: '1000',
      actual: '850',
      gap: '150',
      attributed: '150',
      residual: '0',
      // SME V8: a new plant's first policy (v3 pilot settings) defaults to the economic view
      valuation_view: 'economic_impact',
      value_1: '',
      currency_1: 'IRR',
      value_2: '',
      currency_2: 'USD',
      valuation_status: 'unvalued',
      valuation_reason: 'policy_unapproved',
    });
    expect(first.product_name).toBe(`'=HYPERLINK("http://evil.example","x")`);
    expect((await env.exportJob(jobId)).downloadCount).toBe(1);
  });

  it('exports the published revisions as PDF: plant presentation pinned (USD by default), PDF bytes, hash', async () => {
    const jobId = await env.exportDay({ format: 'pdf' });
    const queued = await env.exportJob(jobId);
    expect(queued).toMatchObject({
      format: 'pdf',
      presentation: { currency: 'USD', calendar: 'gregorian', digits: 'latin' },
    });
    expect(await env.runExports()).toBe(1);
    const done = await env.exportJob(jobId);
    expect(done).toMatchObject({ state: 'completed', rowCount: 2 });
    const file = await env.download(jobId);
    expect(file.status).toBe(200);
    expect(file.text.startsWith('%PDF-')).toBe(true);
    expect(file.hash).toBe(done.contentHash);
    const irr = await env.exportJob(
      await env.exportDay({ format: 'pdf', currency: 'IRR' }),
    );
    expect(irr.presentation).toMatchObject({ currency: 'IRR' });
    await env.runExports();
  });

  it('refuses a PDF larger than EXPORT_PDF_MAX_SOURCES (422 EXPORT_TOO_LARGE)', async () => {
    process.env.EXPORT_PDF_MAX_SOURCES = '1';
    try {
      const response = await env.requestExport({
        reportType: 'period_summary',
        format: 'pdf',
        revisionSelector: 'published',
        from: DAY1,
        to: NEXT_DAY,
        unitIds: [env.world.unitA1],
      });
      expect([response.status, (response.body as ApiError).code]).toEqual([
        422,
        'EXPORT_TOO_LARGE',
      ]);
    } finally {
      delete process.env.EXPORT_PDF_MAX_SOURCES;
    }
  });

  it('loss-line export lists the manual line and sanitizes its user-entered reason', async () => {
    const jobId = await env.exportDay({ reportType: 'loss_lines' });
    await env.runExports();
    const rows = ExportWorld.records((await env.download(jobId)).text);
    const manual = rows.find(
      (r) => r.period_id === env.periodA1 && r.line_source === 'manual',
    );
    expect(manual).toMatchObject({
      quantity: '150',
      state: 'in_force',
      reason: "'@SUM(1+1)*cmd|calc",
      // QA audit 2026-10-19: readable reason code, labels and plant-time columns pinned at request time
      reason_code: expect.stringMatching(/^FEED/) as string,
      line_source_label: 'Manual',
      state_label: 'In force',
    });
    expect(manual?.reason_name).toEqual(expect.any(String));
    expect(manual?.reason_name.length).toBeGreaterThan(0);
  });

  it('CSV files start with a UTF-8 BOM and name the requester and the plant clock', async () => {
    const adminId = (
      JSON.parse(
        Buffer.from(env.admin.split('.')[1], 'base64url').toString('utf8'),
      ) as { sub: string }
    ).sub;
    await env.rows(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id)
       VALUES ($1, 'Export Requester', $2, 'x', 'SuperAdmin', $3)
       ON CONFLICT (id) DO UPDATE SET name = 'Export Requester'`,
      [adminId, `${adminId}@test.local`, env.world.tenantA],
    );
    const jobId = await env.exportDay();
    await env.runExports();
    const { text } = await env.download(jobId);
    expect(text.charCodeAt(0)).toBe(0xfeff);
    const header = Object.fromEntries(
      text
        .replace(CSV_BOM, '')
        .split('\r\n\r\n')[0]
        .split('\r\n')
        .map((line) => line.split(',') as [string, string]),
    );
    expect(header.timezone).toBe('UTC');
    expect(header.requested_by_name).toBe('Export Requester');
    const [row] = ExportWorld.records(text);
    if (header.plant_timezone) {
      expect(row.plant_start).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00[+-]\d{2}:\d{2}$/,
      );
    } else {
      expect(row.plant_start).toBe('');
    }
  });

  it('content is bound to the revisions pinned at request time; re-rendering reproduces the hash', async () => {
    const jobId = await env.exportDay();
    const revised = await env
      .post(`production-periods/${env.periodA1}/revise`, {
        approvedRevision: 1,
        reason: 'recheck',
      })
      .expect(201);
    expect(revised.status).toBe(201);
    await env.settle();
    await env.approvePeriod(env.periodA1, reason);
    expect((await env.view(env.periodA1)).revision.revision).toBe(2);

    await env.runExports();
    const pinned = ExportWorld.records((await env.download(jobId)).text);
    expect(pinned.find((r) => r.period_id === env.periodA1)?.revision).toBe(
      '1',
    );
    const job = await env.harness.dataSource
      .getRepository(ExportJob)
      .findOneByOrFail({ id: jobId });
    const again = await env.app
      .get(ExportRenderer)
      .render(job, () => Promise.resolve('continue'));
    expect(again.status === 'completed' && again.contentHash).toBe(
      job.contentHash,
    );

    const fresh = await env.exportDay();
    await env.runExports();
    const latest = ExportWorld.records((await env.download(fresh)).text);
    expect(latest.find((r) => r.period_id === env.periodA1)?.revision).toBe(
      '2',
    );
    const sources = await env
      .get(`exports/${fresh}/sources?limit=1`)
      .expect(200);
    const page = sources.body as {
      items: Array<{ revision: number; calculationRunId: string }>;
      nextCursor: string;
    };
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toEqual(expect.any(String));
  });

  it('a queued export can be cancelled: no file, download 410, the worker skips it', async () => {
    const jobId = await env.exportDay();
    const cancelled = await env.post(`exports/${jobId}/cancel`, {}).expect(200);
    expect((cancelled.body as { state: string }).state).toBe('cancelled');
    expect(await env.runExports()).toBe(0);
    const file = await env.download(jobId);
    expect([file.status, file.body.code]).toEqual([410, 'EXPORT_CANCELLED']);
    const again = await env.post(`exports/${jobId}/cancel`, {}).expect(409);
    expect((again.body as ApiError).code).toBe('INVALID_TRANSITION');
  });

  it('a running export stops at the next page when cancelled: partial, no file kept', async () => {
    process.env.EXPORT_PAGE_SIZE = '1';
    try {
      const jobId = await env.exportDay();
      await env.rows(
        `UPDATE export_jobs SET state = 'running', cancel_requested = true, lease_owner = 'gone',
                lease_expiry = now() - interval '1 minute' WHERE id = $1`,
        [jobId],
      );
      await env.runExports();
      const job = await env.exportJob(jobId);
      expect(job).toMatchObject({ state: 'cancelled', partial: true });
      expect(job.counts.processed).toBe(1);
      const tenantDir = join(env.storageDir, env.world.tenantA);
      expect(readdirSync(tenantDir).filter((f) => f.startsWith(jobId))).toEqual(
        [],
      );
      expect((await env.download(jobId)).status).toBe(410);
    } finally {
      delete process.env.EXPORT_PAGE_SIZE;
    }
  });

  it('an expired export is 410 and its file is purged; a completed export is immutable', async () => {
    const jobId = await env.exportDay();
    await env.runExports();
    const job = await env.exportJob(jobId);
    await env.rows(
      `UPDATE export_jobs SET expires_at = now() - interval '1 second' WHERE id = $1`,
      [jobId],
    );
    const file = await env.download(jobId);
    expect([file.status, file.body.code]).toEqual([410, 'EXPORT_EXPIRED']);
    expect((await env.exportJob(jobId)).downloadUrl).toBeNull();
    expect(
      await env.app.get(ExportJobsService).purgeExpired(),
    ).toBeGreaterThanOrEqual(1);
    expect(
      existsSync(join(env.storageDir, env.world.tenantA, `${jobId}.csv`)),
    ).toBe(false);
    await expect(
      env.rows(`UPDATE export_jobs SET content_hash = 'x' WHERE id = $1`, [
        jobId,
      ]),
    ).rejects.toThrow('immutable');
    await expect(
      env.rows(`DELETE FROM export_job_sources WHERE export_job_id = $1`, [
        jobId,
      ]),
    ).rejects.toThrow('append-only');
    expect(job.contentHash).toEqual(expect.any(String));
  });

  it('validates selectors, windows and revisions (422)', async () => {
    const draftRevision = (await env.view(env.periodC1)).revision.id;
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ revisionIds: [draftRevision] }, 'INVALID_SELECTOR'],
      [{ from: env.periodA1 }, 'VALIDATION_FAILED'],
      [{ to: '2027-02-01T00:00:00Z' }, 'INVALID_RANGE'],
      [{ to: '2029-03-01T00:00:00Z' }, 'WINDOW_TOO_LARGE'],
      [
        {
          revisionSelector: 'revision_ids',
          from: undefined,
          to: undefined,
          unitIds: undefined,
          revisionIds: [draftRevision],
        },
        'REVISION_NOT_APPROVED',
      ],
      [{ format: 'xlsx' }, 'VALIDATION_FAILED'],
      [{ format: 'pdf', currency: 'EUR' }, 'VALIDATION_FAILED'],
    ];
    for (const [change, code] of cases) {
      const body = {
        reportType: 'period_summary',
        format: 'csv',
        revisionSelector: 'published',
        from: '2027-03-01T02:30:00Z',
        to: '2027-03-02T02:30:00Z',
        unitIds: [env.world.unitA1],
        ...change,
      };
      const response = await env.requestExport(
        JSON.parse(JSON.stringify(body)) as Record<string, unknown>,
      );
      expect([response.status, (response.body as ApiError).code]).toEqual([
        422,
        code,
      ]);
    }
  });
});
