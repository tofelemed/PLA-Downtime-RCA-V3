import { createHash } from 'crypto';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ExportJobsService } from '../../src/exports/export-jobs.service';
import { ApiError } from './support/plan-world';
import { addCodedRootCause } from './support/rca-causes';
import { CaseBody, RcaWorld } from './support/rca-world';
import { bearer } from './support/test-app';

interface JobBody {
  id: string;
  reportType: string;
  revisionSelector: string;
  state: string;
  unitIds: string[] | null;
  presentation: { currency: string } | null;
  filters: { rcaId?: string };
  counts: { accepted: number; processed: number; pending: number };
  contentHash: string | null;
  rowCount: number | null;
}

/**
 * Item 2.5 on real Postgres: an `rca_case` export pins the case when it is requested (immutable content,
 * hashed file, display currency), renders through the export worker as a PDF, and follows the case's
 * scope: a case the requester cannot read is 404, the job's content scope is the case's unit, and a
 * unit-limited user never sees the export of a tenant-wide case.
 */
describe('RCA case PDF export (item 2.5)', () => {
  const env = new RcaWorld();
  let storageDir = '';
  let previousStorage: string | undefined;
  let caseA1: CaseBody;

  const body = (rcaId: string, extra: Record<string, unknown> = {}) => ({
    reportType: 'rca_case',
    format: 'pdf',
    revisionSelector: 'case',
    rcaId,
    ...extra,
  });
  const request = (payload: object, token = env.admin) =>
    env.post('exports', payload, token);
  const job = async (id: string, token = env.admin) =>
    (await env.get(`exports/${id}`, token).expect(200)).body as JobBody;
  const download = async (id: string, token = env.admin) => {
    const response = await env
      .http()
      .get(`/api/v2/exports/${id}/download`)
      .set(bearer(token))
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      });
    const bytes = response.body as Buffer;
    return {
      status: response.status,
      bytes,
      hash: createHash('sha256').update(bytes).digest('hex'),
      header: response.headers['x-content-sha256'],
    };
  };
  const codeOf = (response: { body: unknown }) =>
    (response.body as ApiError).code;

  beforeAll(async () => {
    previousStorage = process.env.EXPORT_STORAGE_DIR;
    storageDir = mkdtempSync(join(tmpdir(), 'proact-rca-export-it-'));
    process.env.EXPORT_STORAGE_DIR = storageDir;
    await env.start();
    caseA1 = await env.createCase(env.example());
    await addCodedRootCause(env, env.world.tenantA, caseA1.id);
    await env
      .post(`rcas/${caseA1.id}/actions`, { title: 'Realign the coupling' })
      .expect(201);
  });
  afterAll(async () => {
    await env.stop();
    rmSync(storageDir, { recursive: true, force: true });
    if (previousStorage === undefined) delete process.env.EXPORT_STORAGE_DIR;
    else process.env.EXPORT_STORAGE_DIR = previousStorage;
  });

  it('queues, pins the case, renders a hashed PDF and reproduces it', async () => {
    const accepted = await request(body(caseA1.id)).expect(202);
    const jobId = (accepted.body as { jobId: string }).jobId;
    const queued = await job(jobId);
    expect(queued).toMatchObject({
      reportType: 'rca_case',
      revisionSelector: 'case',
      state: 'queued',
      unitIds: [env.world.unitA1],
      presentation: { currency: 'USD' },
      filters: { rcaId: caseA1.id },
      counts: { accepted: 1, processed: 0, pending: 1 },
    });
    await env
      .patch(
        `rcas/${caseA1.id}`,
        { title: 'Renamed later' },
        `"${caseA1.rowVersion}"`,
      )
      .expect(200);
    const [pinned] = await env.rows<{ title: string }>(
      `SELECT case_content -> 'case' ->> 'title' AS title FROM export_jobs WHERE id = $1`,
      [jobId],
    );
    expect(pinned.title).toBe(caseA1.title);
    await env.app.get(ExportJobsService).runPending();
    const done = await job(jobId);
    expect(done).toMatchObject({
      state: 'completed',
      counts: { processed: 1, pending: 0 },
    });
    expect(done.rowCount).toBeGreaterThan(0);
    const file = await download(jobId);
    expect(file.status).toBe(200);
    expect(file.bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(file.hash).toBe(done.contentHash);
    expect(file.header).toBe(done.contentHash);
    expect((await download(jobId)).hash).toBe(file.hash);
    const audit = await env.rows<{ action: string }>(
      `SELECT action FROM audit_log WHERE entity_type = 'export_job' AND entity_id = $1`,
      [jobId],
    );
    expect(audit.map((a) => a.action)).toContain('export.requested');
  });

  it('pins the display currency asked for', async () => {
    const accepted = await request(body(caseA1.id, { currency: 'IRR' })).expect(
      202,
    );
    const jobId = (accepted.body as { jobId: string }).jobId;
    expect((await job(jobId)).presentation).toMatchObject({ currency: 'IRR' });
  });

  it('refuses CSV, a missing case and mixed selectors', async () => {
    expect(
      codeOf(await request(body(caseA1.id, { format: 'csv' })).expect(422)),
    ).toBe('FORMAT_NOT_SUPPORTED');
    expect(
      codeOf(
        await request({ ...body(caseA1.id), rcaId: undefined }).expect(422),
      ),
    ).toBe('INVALID_SELECTOR');
    expect(
      codeOf(
        await request(body(caseA1.id, { from: '2026-10-01T00:00:00Z' })).expect(
          422,
        ),
      ),
    ).toBe('INVALID_SELECTOR');
    expect(
      codeOf(
        await request({
          reportType: 'period_summary',
          format: 'pdf',
          revisionSelector: 'published',
          from: '2026-10-01T00:00:00Z',
          to: '2026-10-02T00:00:00Z',
          rcaId: caseA1.id,
        }).expect(422),
      ),
    ).toBe('INVALID_SELECTOR');
    expect(
      codeOf(
        await request(
          body(caseA1.id, { revisionSelector: 'published' }),
        ).expect(422),
      ),
    ).toBe('INVALID_SELECTOR');
  });

  it('follows the case scope: unreadable cases are 404, tenant-wide exports stay tenant-wide', async () => {
    const otherUnit = await env.createCase(
      env.example({ unitId: env.world.unitA2, teamMemberIds: [] }),
    );
    await request(body(otherUnit.id), env.reliability).expect(404);
    await request(body(caseA1.id), env.adminB).expect(404);
    await request(body('00000000-0000-4000-8000-000000000000')).expect(404);
    const own = await request(body(caseA1.id), env.reliability).expect(202);
    const ownId = (own.body as { jobId: string }).jobId;
    expect((await job(ownId, env.reliability)).unitIds).toEqual([
      env.world.unitA1,
    ]);
    const wide = await env.createCase({ title: 'Tenant-wide case' });
    const wideJob = await request(body(wide.id)).expect(202);
    const wideId = (wideJob.body as { jobId: string }).jobId;
    expect((await job(wideId)).unitIds).toBeNull();
    await env.get(`exports/${wideId}`, env.reliability).expect(404);
    await env.get(`exports/${wideId}`, env.adminB).expect(404);
  });

  it('is refused to roles without money (the PDF carries values)', async () => {
    const refused = await request(body(caseA1.id), env.operator).expect(403);
    expect(codeOf(refused)).toBe('MONEY_NOT_VISIBLE');
  });
});
