import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { IntakeService } from '../../src/intake/intake.service';
import { JobRunnerService } from '../../src/intake/jobs/job-runner.service';
import { IntegrationModule } from '../../src/integration/integration.module';
import { ProductionEventModule } from '../../src/production-event/production-event.module';
import { IntegrationHarness } from './harness';
import { countRows } from './support/intake-fixtures';
import { PiJobDriver, usePiTestTimings } from './support/pi-certification';
import { createIntegrationApp } from './support/test-app';
import { PiWebApiSimulator } from '../simulators/pi-web-api/pi-web-api-simulator';
import { bulkFrames, minutesAgo } from '../simulators/pi-web-api/sim-fixtures';

/**
 * Plan 1.6 certification against the PI Web API simulator: T07 paging with a failed page, page
 * manifests, batched attribute reads, lost authentication, a worker killed mid-page and a lease take-over
 * (§6.4 matrix rows ">500 frames", "lost auth", "restart mid-page").
 */
describe('PI event frames: paging, checkpoints and failures (plan 1.6)', () => {
  const harness = new IntegrationHarness();
  const sim = new PiWebApiSimulator();
  let app: INestApplication;
  let pi: PiJobDriver;
  const tenantId = randomUUID();
  const rows = <T>(sql: string, params: unknown[] = []): Promise<T[]> =>
    harness.dataSource.query<T[]>(sql, params);

  beforeAll(async () => {
    usePiTestTimings();
    await harness.start();
    await sim.start();
    app = await createIntegrationApp(harness, {
      modules: [ProductionEventModule, IntegrationModule],
    });
    pi = new PiJobDriver(app, harness, tenantId);
    await pi.connect(sim);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    sim.clearFailures();
    sim.authRevoked = false;
  });

  afterAll(async () => {
    await harness.dataSource.query(
      `UPDATE ingestion_jobs SET state = 'stopped', lease_owner = NULL WHERE tenant_id = $1`,
      [tenantId],
    );
    await app?.close();
    await sim.close();
    await harness.stop();
  });

  const objects = (prefix: string) =>
    countRows(
      harness.dataSource,
      'source_objects',
      'connection_id = $1 AND source_object_id LIKE $2',
      [pi.connectionId, `${prefix}-%`],
    );
  const raws = (prefix: string) =>
    countRows(
      harness.dataSource,
      'raw_observations',
      'connection_id = $1 AND source_object_id LIKE $2',
      [pi.connectionId, `${prefix}-%`],
    );

  it('T07: 1201 frames, pages of 500, page 3 fails → no window checkpoint; the retry yields 1201 unique objects', async () => {
    sim.addFrames(
      bulkFrames({
        prefix: 'T07',
        count: 1201,
        firstStart: minutesAgo(50),
        stepSeconds: 2,
        template: 'T07 Loss',
      }),
    );
    const jobId = await pi.startJob({
      scopeType: 'database',
      scopeId: 'DB-HDPE',
      templateName: 'T07 Loss',
    });
    sim.fail(
      (request) =>
        request.path.endsWith('/eventframes') &&
        request.query.get('startIndex') === '1000',
      500,
      10,
    );

    const first = await pi.runPage(jobId);
    const second = await pi.runPage(jobId);
    const third = await pi.runPage(jobId);

    expect([first.status, second.status, third.status]).toEqual([
      'committed',
      'committed',
      'failed',
    ]);
    const failed = await pi.job(jobId);
    expect(failed.committed_cursor).toMatchObject({
      checkpoint: null,
      window: { startIndex: 1000, page: 2 },
    });
    expect(failed.retry_count).toBe(1);
    expect(await objects('T07')).toBe(1000);

    sim.clearFailures();
    expect(await pi.runPage(jobId)).toMatchObject({
      status: 'committed',
      accepted: 201,
    });
    const done = await pi.job(jobId);
    const window = failed.committed_cursor?.window as { end: string };
    expect(done.committed_cursor).toEqual({
      checkpoint: window.end,
      window: null,
    });
    expect(await objects('T07')).toBe(1201);
    expect(await raws('T07')).toBe(1201);
    const manifest = await rows<{
      page_index: number;
      item_count: number;
      outcome: string;
      attempts: number;
    }>(
      `SELECT page_index, item_count, outcome, attempts FROM pi_page_manifests WHERE job_id = $1 ORDER BY page_index`,
      [jobId],
    );
    expect(manifest).toEqual([
      { page_index: 0, item_count: 500, outcome: 'committed', attempts: 1 },
      { page_index: 1, item_count: 500, outcome: 'committed', attempts: 1 },
      { page_index: 2, item_count: 201, outcome: 'committed', attempts: 2 },
    ]);
    // I13: attributes came in one or two batch calls per page (chunks of 250), never per frame/attribute
    expect(sim.countRequests((r) => r.path === '/batch')).toBe(5);
    expect(sim.countRequests((r) => r.path.startsWith('/streamsets'))).toBe(0);
  });

  it('lost authentication: the job fails at once with health auth_failed and the cursor does not move', async () => {
    const jobId = await pi.startJob({
      scopeType: 'database',
      scopeId: 'DB-HDPE',
      templateName: 'Auth Loss',
    });
    await pi.runWindow(jobId);
    const before = (await pi.job(jobId)).committed_cursor;
    sim.authRevoked = true;

    const outcome = await pi.runPage(jobId);

    expect(outcome).toMatchObject({ status: 'failed', state: 'failed' });
    const job = await pi.job(jobId);
    expect(job).toMatchObject({
      state: 'failed',
      retry_count: 1,
      health: { auth_failed: 1 },
    });
    expect(job.last_error).toMatch(/^PI_AUTH_FAILED/);
    expect(job.committed_cursor).toEqual(before);
  });

  it('a worker killed mid-page and a lease taken over: no skipped and no duplicated frames', async () => {
    sim.addFrames(
      bulkFrames({
        prefix: 'KILL',
        count: 120,
        firstStart: minutesAgo(40),
        stepSeconds: 5,
        template: 'Kill Loss',
      }),
    );
    const jobId = await pi.startJob(
      { scopeType: 'database', scopeId: 'DB-HDPE', templateName: 'Kill Loss' },
      50,
    );
    const intake = app.get(IntakeService);
    const accept = intake.accept.bind(intake) as IntakeService['accept'];
    let accepted = 0;
    jest.spyOn(intake, 'accept').mockImplementation((binding, record) => {
      accepted += 1;
      if (accepted > 30) return Promise.reject(new Error('worker killed'));
      return accept(binding, record);
    });

    expect(await pi.runPage(jobId)).toMatchObject({ status: 'failed' });
    expect((await pi.job(jobId)).committed_cursor).toBeNull();
    jest.restoreAllMocks();

    // a second worker dies holding the lease; a third takes the expired lease over
    await harness.dataSource.query(
      `UPDATE ingestion_jobs SET next_run_at = now() - interval '1 second' WHERE id = $1`,
      [jobId],
    );
    expect(await app.get(JobRunnerService).claim('runner-dead')).toMatchObject({
      jobId,
    });
    await harness.dataSource.query(
      `UPDATE ingestion_jobs SET lease_expiry = now() - interval '1 second' WHERE id = $1`,
      [jobId],
    );
    const outcomes = await pi.runWindow(jobId);

    expect(outcomes.map((outcome) => outcome.status)).toEqual([
      'committed',
      'committed',
      'committed',
    ]);
    expect(await objects('KILL')).toBe(120);
    expect(await raws('KILL')).toBe(120);
    const [dupes] = await rows<{ total: number }>(
      `SELECT coalesce(sum(duplicate_count), 0)::int AS total FROM raw_identities
        WHERE connection_id = $1 AND message_id LIKE 'KILL-%'`,
      [pi.connectionId],
    );
    expect(dupes.total).toBe(30);
    const reclaims = await countRows(
      harness.dataSource,
      'ingestion_job_transitions',
      `job_id = $1 AND action = 'lease_reclaimed'`,
      [jobId],
    );
    expect(reclaims).toBe(1);
  });
});
