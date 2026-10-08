import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { BulkCodeService } from '../../src/event-operations/bulk-code.service';
import { BulkJobService } from '../../src/event-operations/bulk-job.service';
import { ProductionEventModule } from '../../src/production-event/production-event.module';
import { ReasonCode } from '../../src/reason-code/reason-code.entity';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import { at, EventWorld, seedEventWorld } from './support/seed-event-world';
import { createIntegrationApp, signToken } from './support/test-app';
import {
  ErrorBody,
  insertDowntimeEvents,
  json,
  Row,
  V2EventClient,
} from './support/v2-event-client';

type Item = { eventId: string; expectedVersion: number };

interface PreviewBody {
  count: number;
  items: Row[];
  exclusions: Row[];
  affectedWindows: Array<{ unitId: string; from: string; to: string }>;
}

interface JobAcceptedBody {
  jobId: string;
  statusUrl: string;
}

interface JobBody {
  state: string;
  finishedAt: string | null;
  chunks: Array<{
    index: number;
    size: number;
    state: string;
    errorCode?: string;
  }>;
}

/** Plan 1.4 / DT10: bulk-code preview, atomic apply (≤ 500), 202 job with chunks (> 500), isolation. */
describe('bulk coding and jobs (plan 1.4)', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let api: V2EventClient;
  let apiB: V2EventClient;
  let foreignReason: string;

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, {
      modules: [ProductionEventModule, V2Module],
    });
    api = new V2EventClient(
      app,
      signToken(app, { userId: randomUUID(), tenantId: world.tenantA }),
    );
    apiB = new V2EventClient(
      app,
      signToken(app, { userId: randomUUID(), tenantId: world.tenantB }),
    );
    foreignReason = randomUUID();
    await harness.dataSource.getRepository(ReasonCode).insert({
      id: foreignReason,
      code: `RB-${foreignReason.slice(0, 6)}`,
      name: 'Tenant B reason',
      isActive: true,
      tenantId: world.tenantB,
    });
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  const events = (day: string, count: number, unitId = world.unitA2) =>
    insertDowntimeEvents(harness.dataSource, {
      tenantId: world.tenantA,
      unitId,
      from: at('00:00', day),
      count,
    });

  const codedWith = async (ids: string[], reasonCodeId: string) => {
    const [row]: Array<{ count: string }> = await harness.dataSource.query(
      `SELECT COUNT(*) AS count FROM production_events WHERE id = ANY($1) AND reason_code_id = $2`,
      [ids, reasonCodeId],
    );
    return Number(row.count);
  };

  const command = (
    items: Item[],
    preview: boolean,
    reasonCodeId = world.reasonR2,
  ) => ({
    items,
    codes: { reasonCodeId },
    reason: 'bulk triage',
    preview,
  });

  it('preview: before/after per event, exclusions and affected windows; nothing changes', async () => {
    const items = await events('2026-10-11', 3);
    const stale = { ...items[1], expectedVersion: 5 };
    const response = await api
      .bulkCode(
        command(
          [
            items[0],
            stale,
            items[2],
            { eventId: world.events.eB1, expectedVersion: 1 },
            items[0],
          ],
          true,
        ),
      )
      .expect(200);
    const preview = json<PreviewBody>(response);
    expect(preview.count).toBe(2);
    expect(preview.items[0]).toMatchObject({
      eventId: items[0].eventId,
      before: { reasonCodeId: null, codingState: 'uncoded' },
      after: { reasonCodeId: world.reasonR2, codingState: 'coded' },
    });
    expect(preview.exclusions).toEqual([
      { eventId: items[1].eventId, reason: 'stale_version', currentVersion: 1 },
      { eventId: world.events.eB1, reason: 'not_found' },
      { eventId: items[0].eventId, reason: 'duplicate' },
    ]);
    const windows = preview.affectedWindows;
    expect(windows).toHaveLength(2);
    for (const window of windows) {
      expect(window.unitId).toBe(world.unitA2);
      expect(Date.parse(window.to) - Date.parse(window.from)).toBe(30_000);
    }
    expect(
      await codedWith(
        items.map((i) => i.eventId),
        world.reasonR2,
      ),
    ).toBe(0);
  });

  it('500 events apply atomically: an injected failure leaves all 500 unchanged', async () => {
    const items = await events('2026-10-12', 500);
    await harness.dataSource.query(
      `CREATE FUNCTION fail_injected() RETURNS trigger LANGUAGE plpgsql AS $fn$
       BEGIN IF NEW.id = '${items[250].eventId}' THEN RAISE EXCEPTION 'injected failure'; END IF; RETURN NEW; END $fn$`,
    );
    await harness.dataSource.query(
      `CREATE TRIGGER trg_fail_injected BEFORE UPDATE ON production_events
       FOR EACH ROW EXECUTE FUNCTION fail_injected()`,
    );
    try {
      await api.bulkCode(command(items, false)).expect(500);
    } finally {
      await harness.dataSource.query(
        'DROP TRIGGER trg_fail_injected ON production_events',
      );
      await harness.dataSource.query('DROP FUNCTION fail_injected()');
    }
    const ids = items.map((i) => i.eventId);
    expect(await codedWith(ids, world.reasonR2)).toBe(0);
    const applied = await api.bulkCode(command(items, false)).expect(200);
    expect(json<{ applied: number }>(applied).applied).toBe(500);
    expect(await codedWith(ids, world.reasonR2)).toBe(500);
    const history = await api.history(items[0].eventId);
    expect(history.coding.at(-1)).toMatchObject({
      reasonCodeId: world.reasonR2,
      reason: 'bulk code: bulk triage',
    });
  });

  it('an excluded item refuses the whole atomic batch (412 stale, 404 foreign)', async () => {
    const items = await events('2026-10-13', 3);
    const stale = await api
      .bulkCode(command([items[0], { ...items[1], expectedVersion: 9 }], false))
      .expect(412);
    expect(json<ErrorBody>(stale).details?.exclusions).toHaveLength(1);
    await api
      .bulkCode(
        command(
          [items[2], { eventId: world.events.eB1, expectedVersion: 1 }],
          false,
        ),
      )
      .expect(404);
    expect(
      await codedWith(
        items.map((i) => i.eventId),
        world.reasonR2,
      ),
    ).toBe(0);
  });

  it('a foreign reason code → 422 INVALID_REFERENCE; no codes → 422', async () => {
    const items = await events('2026-10-14', 1);
    const foreign = await api
      .bulkCode(command(items, false, foreignReason))
      .expect(422);
    expect(json<ErrorBody>(foreign).code).toBe('INVALID_REFERENCE');
    const none = await api
      .bulkCode({ items, codes: {}, reason: 'x', preview: false })
      .expect(422);
    expect(json<ErrorBody>(none).code).toBe('NO_CODES');
  });

  describe('501+ events → 202 job processed in chunks of 200', () => {
    let items: Item[];
    let jobId: string;
    const key = randomUUID();

    beforeAll(async () => {
      items = await events('2026-10-15', 501);
      items[450] = { ...items[450], expectedVersion: 3 };
    });

    it('accepts the job (202) and replays the acceptance for the same key', async () => {
      const response = await api
        .bulkCode(command(items, false), key)
        .expect(202);
      const accepted = json<JobAcceptedBody>(response);
      jobId = accepted.jobId;
      expect(accepted.statusUrl).toBe(`/api/v2/jobs/${jobId}`);
      const replay = await api.bulkCode(command(items, false), key).expect(202);
      expect(json<JobAcceptedBody>(replay).jobId).toBe(jobId);
      expect(json<Row>(await api.job(jobId).expect(200))).toMatchObject({
        state: 'queued',
        total: 501,
        processed: 0,
      });
    });

    it('another tenant cannot read the job (404)', async () => {
      await apiB.job(jobId).expect(404);
    });

    it('the worker applies the chunks; the chunk with a stale event fails → partial', async () => {
      expect(await app.get(BulkJobService).runPending()).toBe(1);
      const job = json<JobBody>(await api.job(jobId).expect(200));
      expect(job).toMatchObject({
        state: 'partial',
        processed: 400,
        failed: 101,
      });
      expect(typeof job.finishedAt).toBe('string');
      expect(
        job.chunks.map(({ index, size, state }) => [index, size, state]),
      ).toEqual([
        [0, 200, 'completed'],
        [1, 200, 'completed'],
        [2, 101, 'failed'],
      ]);
      expect(job.chunks[2].errorCode).toBe('STALE_REVISION');
      const ids = items.map((i) => i.eventId);
      expect(await codedWith(ids.slice(0, 400), world.reasonR2)).toBe(400);
      expect(await codedWith(ids.slice(400), world.reasonR2)).toBe(0);
    });

    it('a job with foreign ids is refused before it is queued (404)', async () => {
      await api
        .bulkCode(
          command(
            [
              ...items.slice(0, 501),
              { eventId: world.events.eB1, expectedVersion: 1 },
            ],
            false,
          ),
        )
        .expect(404);
    });
  });
  describe('a job abandoned by a dead worker (plan 1.5 lease)', () => {
    it('is reclaimed after its lease expires and continues after its last recorded chunk', async () => {
      const items = await events('2026-10-16', 501);
      const accepted = await api.bulkCode(command(items, false)).expect(202);
      const jobId = json<JobAcceptedBody>(accepted).jobId;
      const bulkCode = app.get(BulkCodeService);
      const apply = bulkCode.apply.bind(bulkCode) as BulkCodeService['apply'];
      let calls = 0;
      // worker A applies chunk 0, then hangs forever inside chunk 1 (process frozen / killed)
      jest.spyOn(bulkCode, 'apply').mockImplementation((...args) => {
        calls += 1;
        return calls === 1 ? apply(...args) : new Promise(() => undefined);
      });
      void app.get(BulkJobService).runPending('worker-A');
      const recorded = async () =>
        (
          await harness.dataSource.query<Array<{ chunks: unknown[] }>>(
            `SELECT chunks FROM bulk_jobs WHERE id = $1`,
            [jobId],
          )
        )[0].chunks.length;
      for (let tries = 0; (await recorded()) < 1 && tries < 500; tries++) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      jest.restoreAllMocks();

      expect(await app.get(BulkJobService).runPending('worker-B')).toBe(0);
      await harness.dataSource.query(
        `UPDATE bulk_jobs SET lease_expiry = now() - interval '1 second' WHERE id = $1`,
        [jobId],
      );
      expect(await app.get(BulkJobService).runPending('worker-B')).toBe(1);

      const job = json<JobBody>(await api.job(jobId).expect(200));
      expect(job.state).toBe('completed');
      expect(job.chunks.map(({ index, state }) => [index, state])).toEqual([
        [0, 'completed'],
        [1, 'completed'],
        [2, 'completed'],
      ]);
      const [row] = await harness.dataSource.query<
        Array<{ attempts: number; lease_owner: string | null }>
      >(`SELECT attempts, lease_owner FROM bulk_jobs WHERE id = $1`, [jobId]);
      expect(row).toEqual({ attempts: 2, lease_owner: null });
      expect(
        await codedWith(
          items.map((i) => i.eventId),
          world.reasonR2,
        ),
      ).toBe(501);
    });
  });
});
