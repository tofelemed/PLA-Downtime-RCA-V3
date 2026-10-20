import { A, HOUR, NEXT_DAY } from './support/actuals-world';
import { plus } from './support/accounting-world';
import { ExportWorld } from './support/export-world';
import { DAY1 } from './support/plan-world';
import { bearer } from './support/test-app';

interface JobBody {
  state: string;
  reportType: string;
  revisionSelector: string;
  format: string;
  unitIds: string[] | null;
  rowCount: number | null;
}

/**
 * Report exports (owner 2026-10-20, `plans/REPORTS_R1_R12.md` § Exports) on real Postgres: the daily
 * report is pinned on an `ops_report` job, rendered by the export worker as a PDF and as a workbook and
 * downloaded from the report route; a role without money gets an export without money it may download;
 * unknown kinds and invalid report queries are refused before any job exists.
 */
describe('Operating report exports', () => {
  const env = new ExportWorld();
  let window = '';

  const exportReport = async (
    kind: string,
    query: string,
    body: object,
    token = env.admin,
  ) => {
    const response = await env
      .post(`reports/${kind}/export?${query}`, body, token)
      .expect(202);
    return (response.body as { jobId: string }).jobId;
  };

  const download = (id: string, token = env.admin) =>
    env
      .http()
      .get(`/api/v2/reports/exports/${id}/download`)
      .set(bearer(token))
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      });

  beforeAll(async () => {
    await env.start();
    window = `unitIds=${env.world.unitA1}&from=${encodeURIComponent(DAY1)}&to=${encodeURIComponent(NEXT_DAY)}`;
    await env.lossEvent(env.world.unitA1, plus(A, HOUR), 1, {
      reasonCodeId: await env.reasonCode('FEED'),
    });
    await env.settle();
  });
  afterAll(() => env.stop());

  it('daily report as a PDF: pinned on an ops_report job, rendered by the worker, downloaded', async () => {
    const id = await exportReport(
      'daily',
      `${window}&monthFrom=${encodeURIComponent(DAY1)}`,
      { format: 'pdf', currency: 'USD' },
    );
    await env.runExports();
    const job = (await env.get(`exports/${id}`).expect(200)).body as JobBody;
    expect(job).toMatchObject({
      state: 'completed',
      reportType: 'ops_report',
      revisionSelector: 'report',
      format: 'pdf',
      unitIds: [env.world.unitA1],
    });
    expect(job.rowCount).toBeGreaterThan(0);
    const file = await download(id).expect(200);
    expect(file.headers['content-type']).toContain('application/pdf');
    expect((file.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('daily report as a workbook', async () => {
    const id = await exportReport('daily', window, { format: 'xlsx' });
    await env.runExports();
    const file = await download(id).expect(200);
    expect(file.headers['content-type']).toContain('spreadsheetml');
    expect((file.body as Buffer).subarray(0, 2).toString()).toBe('PK');
  });

  it('a role without money exports and downloads a report without money', async () => {
    const operator = await env.scopedUser('operator');
    const id = await exportReport('daily', window, { format: 'pdf' }, operator);
    await env.runExports();
    await download(id, operator).expect(200);
  });

  it('refuses an unknown report (404) and a query its report does not take (422)', async () => {
    await env
      .post(`reports/nothing/export?${window}`, { format: 'pdf' })
      .expect(404);
    await env
      .post(`reports/daily/export?${window}&groupBy=day`, { format: 'pdf' })
      .expect(422);
    await env
      .post(`reports/daily/export?${window}`, { format: 'docx' })
      .expect(422);
  });
});
