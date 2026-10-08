import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InProcessEventBus } from '../../src/common/outbox/in-process-event-bus';
import { InboxService } from '../../src/common/outbox/inbox.service';
import { OutboxRelayService } from '../../src/common/outbox/outbox-relay.service';
import { enqueueOutbox } from '../../src/common/outbox/outbox-writer';
import { PublishedMessage } from '../../src/common/outbox/outbox-transport';
import { IntakeModule } from '../../src/intake/intake.module';
import { IntakeService } from '../../src/intake/intake.service';
import { IntakeBinding } from '../../src/intake/intake.types';
import { NormalizationService } from '../../src/intake/normalization/normalization.service';
import { IntegrationHarness } from './harness';
import {
  countRows,
  insertConnection,
  measurement,
} from './support/intake-fixtures';
import { createIntegrationApp } from './support/test-app';

/** Plan 1.5: intake accept (FND01/FND02, ING01), T10 inbox, transactional outbox relay (API05). */
describe('durable intake core (plan 1.5)', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let intake: IntakeService;
  let binding: IntakeBinding;
  const rows = <T>(sql: string, params: unknown[] = []): Promise<T[]> =>
    harness.dataSource.query<T[]>(sql, params);

  beforeAll(async () => {
    await harness.start();
    app = await createIntegrationApp(harness, { modules: [IntakeModule] });
    intake = app.get(IntakeService);
    const tenantId = randomUUID();
    binding = {
      tenantId,
      connectionId: await insertConnection(harness.dataSource, tenantId),
    };
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  const envelope = (objectId: string, minute: number, value: number) =>
    measurement({ ...binding, objectId, minute, value });

  describe('accept (FND01, ING01)', () => {
    it('retains a first delivery, registers the source object and requests normalisation', async () => {
      const result = await intake.accept(binding, envelope('pump-1', 0, 1));

      expect(result.status).toBe('accepted');
      expect(result.ticket?.key).toMatch(/^normalize:\d+$/);
      const [raw] = await rows<{ outcome: string; partition: string }>(
        `SELECT outcome, tableoid::regclass::text AS partition FROM raw_observations WHERE id = $1`,
        [result.rawId],
      );
      const month = new Date().toISOString().slice(0, 7).split('-');
      expect(raw).toEqual({
        outcome: 'accepted',
        partition: `raw_observations_y${month[0]}m${month[1]}`,
      });
      const [object] = await rows<{ latest_raw_id: string }>(
        `SELECT latest_raw_id FROM source_objects WHERE source_object_id = 'pump-1'`,
      );
      expect(object.latest_raw_id).toBe(result.rawId);
      expect(
        await countRows(
          harness.dataSource,
          'outbox',
          `type = 'RawAccepted' AND aggregate_id LIKE '%pump-1'`,
        ),
      ).toBe(1);
    });

    it('counts a repeated message id without a new raw row; retries only a non-normalised object', async () => {
      const retry = await intake.accept(binding, envelope('pump-1', 0, 1));
      expect(retry.status).toBe('duplicate');
      expect(retry.ticket).not.toBeNull();

      await harness.dataSource.query(
        `UPDATE source_objects SET normalized_raw_id = latest_raw_id WHERE source_object_id = 'pump-1'`,
      );
      const repeat = await intake.accept(binding, envelope('pump-1', 0, 1));

      expect(repeat).toMatchObject({ status: 'duplicate', ticket: null });
      expect(
        await countRows(
          harness.dataSource,
          'raw_observations',
          `source_object_id = 'pump-1'`,
        ),
      ).toBe(1);
      const [identity] = await rows<{ duplicate_count: number }>(
        `SELECT duplicate_count FROM raw_identities WHERE raw_id = $1`,
        [repeat.rawId],
      );
      expect(identity.duplicate_count).toBe(2);
    });

    it('orders versions: same content, newer, older (stale) and an unprovable tie (conflict)', async () => {
      const same = await intake.accept(binding, {
        ...envelope('pump-1', 0, 1),
        messageId: 'pump-1:redelivered',
        observedAt: new Date(Date.UTC(2026, 9, 8, 6, 5)).toISOString(),
      });
      const newer = await intake.accept(binding, envelope('pump-1', 10, 2));
      const older = await intake.accept(binding, envelope('pump-1', 7, 3));
      const tie = await intake.accept(binding, envelope('pump-1', 10, 4));

      expect([same.status, newer.status, older.status, tie.status]).toEqual([
        'duplicate_content',
        'revision',
        'stale',
        'conflict',
      ]);
      expect([same.ticket, older.ticket, tie.ticket]).toEqual([
        null,
        null,
        null,
      ]);
      const [object] = await rows<{ latest_raw_id: string }>(
        `SELECT latest_raw_id FROM source_objects WHERE source_object_id = 'pump-1'`,
      );
      expect(object.latest_raw_id).toBe(newer.rawId);
      const [conflict] = await rows<{ error_code: string; raw_id: string }>(
        `SELECT error_code, raw_id FROM ingestion_exceptions WHERE source_object_id = 'pump-1' AND state = 'open'`,
      );
      expect(conflict).toEqual({
        error_code: 'order_conflict',
        raw_id: tie.rawId,
      });
    });

    it('retains and quarantines a schema-invalid envelope', async () => {
      const broken = {
        ...envelope('pump-2', 0, 1),
        observedAt: 'yesterday',
        extra: true,
      };

      const result = await intake.accept(binding, broken);

      expect(result).toMatchObject({ status: 'invalid', ticket: null });
      const [exception] = await rows<{
        error_code: string;
        detail: { violations: unknown[] };
      }>(
        `SELECT error_code, detail FROM ingestion_exceptions WHERE raw_id = $1`,
        [result.rawId],
      );
      expect(exception.error_code).toBe('schema_invalid');
      expect(exception.detail.violations.length).toBeGreaterThanOrEqual(2);
    });

    it('refuses an envelope of another tenant than the adapter binding (nothing stored)', async () => {
      const foreign = measurement({
        ...binding,
        tenantId: randomUUID(),
        objectId: 'x',
        minute: 0,
        value: 1,
      });

      await expect(intake.accept(binding, foreign)).rejects.toMatchObject({
        status: 403,
      });
      expect(
        await countRows(
          harness.dataSource,
          'raw_observations',
          `source_object_id = 'x'`,
        ),
      ).toBe(0);
    });

    it('keeps raw rows immutable', async () => {
      await expect(
        harness.dataSource.query(
          `UPDATE raw_observations SET payload_size = 0`,
        ),
      ).rejects.toThrow(/immutable/);
      await expect(
        harness.dataSource.query(`DELETE FROM raw_observations`),
      ).rejects.toThrow(/immutable/);
    });

    it('quarantines a record no normaliser handles yet (no_handler), once per inbox key', async () => {
      const result = await intake.accept(binding, envelope('pump-3', 0, 1));
      const normalization = app.get(NormalizationService);

      const first = await normalization.normalize(result.ticket!);
      const again = await normalization.normalize(result.ticket!);

      expect(first).toMatchObject({
        status: 'processed',
        result: { status: 'quarantined', errorCode: 'no_handler' },
      });
      expect(again).toEqual({ status: 'duplicate' });
      expect(
        await countRows(
          harness.dataSource,
          'ingestion_exceptions',
          `source_object_id = 'pump-3' AND error_code = 'no_handler'`,
        ),
      ).toBe(1);
    });
  });

  describe('T10 (inbox part): a redelivery has no second effect', () => {
    const delivery = () => ({
      key: `test:${randomUUID()}`,
      tenantId: binding.tenantId,
      consumer: 'test',
      type: 'Ping',
    });
    const effects = (key: string) =>
      countRows(harness.dataSource, 'test_inbox_effects', 'key = $1', [key]);

    beforeAll(async () => {
      await harness.dataSource.query(
        `CREATE TABLE test_inbox_effects (key text NOT NULL)`,
      );
    });

    afterAll(async () => {
      await harness.dataSource.query(`DROP TABLE test_inbox_effects`);
    });

    it('a consumer crash before the inbox commit leaves no key and no effect; the redelivery applies once', async () => {
      const inbox = app.get(InboxService);
      const message = delivery();
      const effect = (crash: boolean) =>
        inbox.runOnce(message, async (manager) => {
          await manager.query(
            `INSERT INTO test_inbox_effects (key) VALUES ($1)`,
            [message.key],
          );
          if (crash) throw new Error('consumer crashed');
          return 'done';
        });

      await expect(effect(true)).rejects.toThrow('consumer crashed');
      expect(await effects(message.key)).toBe(0);
      expect(
        await countRows(harness.dataSource, 'inbox', 'delivery_key = $1', [
          message.key,
        ]),
      ).toBe(0);

      expect(await effect(false)).toEqual({
        status: 'processed',
        result: 'done',
      });
      expect(await effect(false)).toEqual({ status: 'duplicate' });
      expect(await effects(message.key)).toBe(1);
    });

    it('concurrent duplicate deliveries take effect exactly once', async () => {
      const inbox = app.get(InboxService);
      const message = delivery();
      const outcomes = await Promise.all(
        [1, 2, 3].map(() =>
          inbox.runOnce(message, (manager) =>
            manager.query(`INSERT INTO test_inbox_effects (key) VALUES ($1)`, [
              message.key,
            ]),
          ),
        ),
      );

      expect(
        outcomes.filter((outcome) => outcome.status === 'processed'),
      ).toHaveLength(1);
      expect(await effects(message.key)).toBe(1);
    });
  });

  describe('outbox relay (FND02, API05)', () => {
    const calls: Array<{ id: string; aggregateId: string }> = [];
    let failing = new Set<string>();
    let unsubscribe: () => void;
    let relay: OutboxRelayService;

    beforeAll(async () => {
      await harness.dataSource.query(`DELETE FROM outbox`);
      relay = app.get(OutboxRelayService);
      unsubscribe = app
        .get(InProcessEventBus)
        .subscribe('TestPing', (message: PublishedMessage) => {
          calls.push({ id: message.id, aggregateId: message.aggregateId });
          if (failing.has(message.id))
            return Promise.reject(new Error('broker down'));
          return Promise.resolve();
        });
    });

    afterAll(() => unsubscribe());

    const enqueue = (aggregateId: string) =>
      harness.dataSource.transaction(
        async (manager) =>
          (
            await enqueueOutbox(manager, [
              {
                tenantId: binding.tenantId,
                aggregateType: 'test',
                aggregateId,
                type: 'TestPing',
                payload: {},
              },
            ])
          )[0],
      );
    const outboxRow = async (id: string) =>
      (
        await rows<{
          state: string;
          attempts: number;
          due: boolean;
          published: boolean;
        }>(
          `SELECT state, attempts, next_attempt_at <= now() AS due, published_at IS NOT NULL AS published FROM outbox WHERE id = $1`,
          [id],
        )
      )[0];

    it('publishes each id once; a failed publish backs off and holds back later rows of its aggregate', async () => {
      const a = await enqueue('X');
      const b = await enqueue('X');
      const c = await enqueue('Y');
      failing = new Set([a]);

      expect(await relay.relayBatch()).toEqual({
        published: 1,
        failed: 1,
        deferred: 1,
      });
      expect(await outboxRow(a)).toMatchObject({
        state: 'pending',
        attempts: 1,
        due: false,
      });
      expect(await relay.relayBatch()).toEqual({
        published: 0,
        failed: 0,
        deferred: 0,
      });

      failing = new Set();
      await harness.dataSource.query(
        `UPDATE outbox SET next_attempt_at = now() WHERE id = $1`,
        [a],
      );
      expect(await relay.relayBatch()).toEqual({
        published: 2,
        failed: 0,
        deferred: 0,
      });
      expect(await relay.relayBatch()).toEqual({
        published: 0,
        failed: 0,
        deferred: 0,
      });

      expect(calls.map((call) => call.id)).toEqual([a, c, a, b]);
      for (const id of [a, b, c]) {
        expect(await outboxRow(id)).toMatchObject({
          state: 'published',
          published: true,
        });
      }
    });

    it('marks a row failed after OUTBOX_MAX_ATTEMPTS', async () => {
      process.env.OUTBOX_MAX_ATTEMPTS = '2';
      try {
        const d = await enqueue('Z');
        failing = new Set([d]);
        await relay.relayBatch();
        await harness.dataSource.query(
          `UPDATE outbox SET next_attempt_at = now() WHERE id = $1`,
          [d],
        );
        await relay.relayBatch();

        expect(await outboxRow(d)).toMatchObject({
          state: 'failed',
          attempts: 2,
        });
      } finally {
        delete process.env.OUTBOX_MAX_ATTEMPTS;
      }
    });
  });
});
