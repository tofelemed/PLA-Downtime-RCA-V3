import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  anonymousContext,
  RequestContext,
} from '../../src/common/context/request-context';
import { AdapterRegistry } from '../../src/intake/adapters/adapter-registry';
import { ReadPage } from '../../src/intake/adapters/adapter.interface';
import { IntakeModule } from '../../src/intake/intake.module';
import { IntakeService } from '../../src/intake/intake.service';
import { IngestionJobsService } from '../../src/intake/jobs/ingestion-jobs.service';
import { JobRunnerService } from '../../src/intake/jobs/job-runner.service';
import { IntegrationHarness } from './harness';
import { FakeAdapter } from './support/fake-adapter';
import {
  countRows,
  insertConnection,
  measurement,
} from './support/intake-fixtures';
import { createIntegrationApp } from './support/test-app';

/** A promise with its resolver: the tests wait on events, never on wall-clock sleeps. */
function deferred<T = void>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

/** Plan 1.5: leased jobs (ING02), crash recovery (FND01 checkpoint after accept), lifecycle. */
describe('ingestion jobs and leases (plan 1.5)', () => {
  const harness = new IntegrationHarness();
  const fake = new FakeAdapter();
  let app: INestApplication;
  let runner: JobRunnerService;
  let jobs: IngestionJobsService;
  let context: RequestContext;
  let connectionId: string;
  const tenantId = randomUUID();
  const rows = <T>(sql: string, params: unknown[] = []): Promise<T[]> =>
    harness.dataSource.query<T[]>(sql, params);

  beforeAll(async () => {
    await harness.start();
    app = await createIntegrationApp(harness, {
      modules: [IntakeModule],
    });
    app.get(AdapterRegistry).register(fake);
    runner = app.get(JobRunnerService);
    jobs = app.get(IngestionJobsService);
    context = {
      ...anonymousContext('jobs-test'),
      tenantId,
      userId: randomUUID(),
    };
    connectionId = await insertConnection(harness.dataSource, tenantId);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await harness.dataSource.query(
      `UPDATE ingestion_jobs SET state = 'stopped', lease_owner = NULL, lease_expiry = NULL`,
    );
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  /**
   * Creates and starts a job; `start` makes it due by the database clock (the clock the claim compares
   * with), so a claim right after never depends on the host and container clocks agreeing.
   */
  const startJob = async (scope: Record<string, unknown>) =>
    (await jobs.create(context, connectionId, { scope, start: true })).id;
  const page = (prefix: string, count: number, cursor: number): ReadPage => ({
    records: Array.from({ length: count }, (_, index) =>
      measurement({
        tenantId,
        connectionId,
        objectId: `${prefix}-${index}`,
        minute: 0,
        value: index,
      }),
    ),
    nextCursor: { position: cursor },
    hasMore: false,
  });
  const job = async (id: string) =>
    (
      await rows<{
        state: string;
        lease_owner: string | null;
        committed_cursor: unknown;
        retry_count: number;
      }>(
        `SELECT state, lease_owner, committed_cursor, retry_count FROM ingestion_jobs WHERE id = $1`,
        [id],
      )
    )[0];
  const actions = async (id: string) =>
    (
      await rows<{ action: string }>(
        `SELECT action FROM ingestion_job_transitions WHERE job_id = $1 ORDER BY created_at, action`,
        [id],
      )
    ).map((row) => row.action);
  const expireLease = (id: string) =>
    harness.dataSource.query(
      `UPDATE ingestion_jobs SET lease_expiry = now() - interval '1 second' WHERE id = $1`,
      [id],
    );

  describe('leases (ING02)', () => {
    it('two runners, one job: exactly one lease holder; an expired lease is taken over and audited', async () => {
      const id = await startJob({ case: 'lease' });

      const claims = await Promise.all([
        runner.claim('runner-A'),
        runner.claim('runner-B'),
      ]);

      expect(claims.filter((claim) => claim !== null)).toHaveLength(1);
      const holder = claims.find((claim) => claim)!.owner;
      expect(await runner.claim('runner-C')).toBeNull();

      await expireLease(id);
      expect(await runner.claim('runner-C')).toMatchObject({
        jobId: id,
        owner: 'runner-C',
      });
      const [reclaim] = await rows<{
        runner: string;
        detail: { previousOwner: string };
      }>(
        `SELECT runner, detail FROM ingestion_job_transitions WHERE job_id = $1 AND action = 'lease_reclaimed'`,
        [id],
      );
      expect(reclaim).toEqual({
        runner: 'runner-C',
        detail: { previousOwner: holder },
      });
    });
  });

  it('start makes the job due by the database clock (no host/container clock dependency)', async () => {
    const id = await startJob({ case: 'due' });

    const [row] = await rows<{ due: boolean }>(
      `SELECT next_run_at <= now() AS due FROM ingestion_jobs WHERE id = $1`,
      [id],
    );
    expect(row.due).toBe(true);
    expect(await runner.claim('runner-A')).toMatchObject({ jobId: id });
  });

  describe('crash recovery (FND01)', () => {
    it('an abort mid-page keeps the cursor; the restart re-reads the page with no duplicate source objects', async () => {
      const id = await startJob({ case: 'crash' });
      fake.next = () => Promise.resolve(page('crash', 10, 10));
      const intake = app.get(IntakeService);
      const accept = intake.accept.bind(intake) as IntakeService['accept'];
      let accepted = 0;
      jest.spyOn(intake, 'accept').mockImplementation((binding, record) => {
        accepted += 1;
        if (accepted > 3) return Promise.reject(new Error('worker killed'));
        return accept(binding, record);
      });

      expect(await runner.runOnce('runner-A')).toMatchObject({
        status: 'failed',
        error: 'worker killed',
      });
      expect(await job(id)).toMatchObject({
        committed_cursor: null,
        retry_count: 1,
        lease_owner: null,
      });
      expect(
        await countRows(
          harness.dataSource,
          'raw_observations',
          `source_object_id LIKE 'crash-%'`,
        ),
      ).toBe(3);

      jest.restoreAllMocks();
      await harness.dataSource.query(
        `UPDATE ingestion_jobs SET next_run_at = now() WHERE id = $1`,
        [id],
      );
      expect(await runner.runOnce('runner-B')).toMatchObject({
        status: 'committed',
        accepted: 10,
      });

      expect(await job(id)).toMatchObject({
        committed_cursor: { position: 10 },
        retry_count: 0,
      });
      expect(
        await countRows(
          harness.dataSource,
          'source_objects',
          `source_object_id LIKE 'crash-%'`,
        ),
      ).toBe(10);
      expect(
        await countRows(
          harness.dataSource,
          'raw_observations',
          `source_object_id LIKE 'crash-%'`,
        ),
      ).toBe(10);
      const [dupes] = await rows<{ total: number }>(
        `SELECT sum(duplicate_count)::int AS total FROM raw_identities WHERE message_id LIKE 'crash-%'`,
      );
      expect(dupes.total).toBe(3);
    });

    it('a dead worker (lease held, never committed) is replaced after the lease expires', async () => {
      const id = await startJob({ case: 'dead-worker' });
      fake.next = () => Promise.resolve(page('dead', 5, 5));
      expect(await runner.claim('runner-dead')).toMatchObject({ jobId: id });

      expect(await runner.runOnce('runner-B')).toBeNull();
      await expireLease(id);
      expect(await runner.runOnce('runner-B')).toMatchObject({
        status: 'committed',
        accepted: 5,
      });

      expect(await job(id)).toMatchObject({
        committed_cursor: { position: 5 },
        lease_owner: null,
      });
      expect(
        await countRows(
          harness.dataSource,
          'source_objects',
          `source_object_id LIKE 'dead-%'`,
        ),
      ).toBe(5);
      expect(await actions(id)).toContain('lease_reclaimed');
    });
  });

  describe('lifecycle (ING02)', () => {
    it('stop lets the in-flight page finish and commit, then no new page starts', async () => {
      const id = await startJob({ case: 'stop' });
      const reading = deferred();
      const release = deferred<ReadPage>();
      fake.next = () => {
        reading.resolve();
        return release.promise;
      };

      const inFlight = runner.runOnce('runner-A');
      await reading.promise;
      const stopped = await jobs.command(context, id, 'stop', 'maintenance');
      expect(stopped).toMatchObject({
        state: 'stopped',
        leaseOwner: 'runner-A',
      });
      release.resolve(page('stop', 2, 2));

      expect(await inFlight).toMatchObject({
        status: 'committed',
        state: 'stopped',
      });
      expect(await job(id)).toMatchObject({
        state: 'stopped',
        lease_owner: null,
        committed_cursor: { position: 2 },
      });
      expect(await runner.runOnce('runner-A')).toBeNull();
      expect(await actions(id)).toEqual(['create', 'start', 'stop']);
    });

    it('drain stops the job once the source is caught up', async () => {
      const id = await startJob({ case: 'drain' });
      await jobs.command(context, id, 'drain');
      fake.next = () => Promise.resolve(page('drain', 1, 1));

      expect(await runner.runOnce('runner-A')).toMatchObject({
        status: 'committed',
        state: 'stopped',
      });
      expect(await actions(id)).toEqual([
        'create',
        'start',
        'drain',
        'drained',
      ]);
    });

    it('a failing source backs off and fails the job after INTAKE_MAX_RETRIES', async () => {
      process.env.INTAKE_MAX_RETRIES = '2';
      try {
        const id = await startJob({ case: 'failing' });
        fake.next = () => Promise.reject(new Error('source unreachable'));

        await runner.runOnce('runner-A');
        const [first] = await rows<{ due: boolean; state: string }>(
          `SELECT next_run_at <= now() AS due, state FROM ingestion_jobs WHERE id = $1`,
          [id],
        );
        expect(first).toEqual({ due: false, state: 'running' });
        await harness.dataSource.query(
          `UPDATE ingestion_jobs SET next_run_at = now() WHERE id = $1`,
          [id],
        );
        await runner.runOnce('runner-A');

        expect(await job(id)).toMatchObject({
          state: 'failed',
          retry_count: 2,
        });
        expect(await actions(id)).toContain('failed');
      } finally {
        delete process.env.INTAKE_MAX_RETRIES;
      }
    });
  });
});
