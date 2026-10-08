import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as fc from 'fast-check';
import * as request from 'supertest';
import { CanonicalEnvelope } from '../../src/intake/envelope/canonical-envelope';
import { IntakeService } from '../../src/intake/intake.service';
import { IntakeBinding } from '../../src/intake/intake.types';
import { NormalizationService } from '../../src/intake/normalization/normalization.service';
import { ReplayService } from '../../src/intake/replay/replay.service';
import { contentHashOf } from '../../src/intake/source-object-ordering';
import { IntegrationModule } from '../../src/integration/integration.module';
import { piFrameEnvelope } from '../../src/integration/pi-envelope';
import { PiEventFrame } from '../../src/integration/pi-frame-ingest.service';
import { ProductionEventModule } from '../../src/production-event/production-event.module';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import { countRows, insertConnection } from './support/intake-fixtures';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

const minute = (value: number) => new Date(Date.UTC(2026, 9, 8, 6, value));

/** Plan 1.5: T06 quarantine → mapping fix → replay, and replay invariance (property). */
describe('PI intake, quarantine and replay (plan 1.5)', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let binding: IntakeBinding;
  let admin: string;
  const rows = <T>(sql: string, params: unknown[] = []): Promise<T[]> =>
    harness.dataSource.query<T[]>(sql, params);

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, {
      modules: [ProductionEventModule, IntegrationModule, V2Module],
    });
    binding = {
      tenantId: world.tenantA,
      connectionId: await insertConnection(
        harness.dataSource,
        world.tenantA,
        'pi_web_api',
      ),
    };
    admin = signToken(app, {
      userId: randomUUID(),
      tenantId: world.tenantA,
      role: 'TenantAdmin',
    });
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  const http = () => request(app.getHttpServer());
  const bind = (webId: string, unitId: string) =>
    harness.dataSource.query(
      `INSERT INTO af_bindings (tenant_id, web_id, local_id, bound_type, is_active) VALUES ($1, $2, $3, 'unit', true)`,
      [world.tenantA, webId, unitId],
    );
  const frame = (
    webId: string,
    element: string,
    end: number | null,
  ): PiEventFrame => ({
    WebId: webId,
    Name: `stop ${webId}`,
    TemplateName: 'Production Loss',
    StartTime: minute(0).toISOString(),
    EndTime: end === null ? null : minute(end).toISOString(),
    PrimaryReferencedElement: {
      WebId: element,
      Path: `\\\\AF\\HDPE\\${element}`,
    },
  });
  const envelopeOf = (
    piFrame: PiEventFrame,
    readAt: number,
  ): CanonicalEnvelope =>
    piFrameEnvelope(
      binding,
      { frame: piFrame, attributes: {} },
      { at: minute(readAt), correlationId: 'test' },
    );
  /** accept + inline normalisation, as a relay delivery would do it */
  const deliver = async (envelope: CanonicalEnvelope) => {
    const accepted = await app.get(IntakeService).accept(binding, envelope);
    return accepted.ticket
      ? app.get(NormalizationService).normalize(accepted.ticket)
      : null;
  };
  const eventOf = async (webId: string) =>
    rows<{
      id: string;
      unit_id: string;
      end_time: Date | null;
      physical_state: string;
    }>(
      `SELECT id, unit_id, end_time, physical_state FROM production_events WHERE event_id = $1`,
      [webId],
    );

  describe('T06: quarantine, fix the mapping, replay twice → one canonical event', () => {
    const webId = `EF-T06-${randomUUID()}`;
    let exceptionId: string;
    const post = (path: string, body: object, token = admin) =>
      http()
        .post(`/api/v2/${path}`)
        .set(bearer(token))
        .set('Idempotency-Key', randomUUID())
        .send(body);
    const runReplays = () => app.get(ReplayService).runPending('test-runner');
    const replayRun = async (id: string) =>
      (
        await http()
          .get(`/api/v2/replay-runs/${id}`)
          .set(bearer(admin))
          .expect(200)
      ).body as {
        state: string;
        counts: Record<string, number>;
      };

    it('an unknown element path is quarantined as unknown_unit', async () => {
      await deliver(envelopeOf(frame(webId, 'EL-T06', 20), 1));

      const list = await http()
        .get('/api/v2/ingestion-exceptions')
        .query({
          state: 'open',
          errorCode: 'unknown_unit',
          sourceObjectId: webId,
        })
        .set(bearer(admin))
        .expect(200);
      const items = (list.body as { items: Array<{ id: string }> }).items;
      expect(items).toHaveLength(1);
      exceptionId = items[0].id;
      const detail = await http()
        .get(`/api/v2/ingestion-exceptions/${exceptionId}`)
        .set(bearer(admin))
        .expect(200);
      expect(
        (detail.body as { raw: { payload: { sourceObjectId: string } } }).raw
          .payload.sourceObjectId,
      ).toBe(webId);
    });

    it('needs a replay role and the caller tenant', async () => {
      const analyst = signToken(app, {
        userId: randomUUID(),
        tenantId: world.tenantA,
      });
      const tenantB = signToken(app, {
        userId: randomUUID(),
        tenantId: world.tenantB,
        role: 'TenantAdmin',
      });
      await post(
        `ingestion-exceptions/${exceptionId}/resolve`,
        { action: 'replay', reason: 'x' },
        analyst,
      ).expect(403);
      await post(
        `ingestion-exceptions/${exceptionId}/resolve`,
        { action: 'replay', reason: 'x' },
        tenantB,
      ).expect(404);
      await post(
        `connections/${binding.connectionId}/replays`,
        { reason: 'x' },
        tenantB,
      ).expect(404);
    });

    it('after the mapping is added, two replays yield exactly one event; raw rows keep both deliveries', async () => {
      await bind('EL-T06', world.unitA2);

      const first = await post(`ingestion-exceptions/${exceptionId}/resolve`, {
        action: 'replay',
        reason: 'binding added',
      }).expect(202);
      await runReplays();
      const second = await post(`connections/${binding.connectionId}/replays`, {
        reason: 'again',
        sourceObjectIds: [webId],
      }).expect(202);
      await runReplays();

      const runOne = (first.body as { jobId: string }).jobId;
      const runTwo = (second.body as { jobId: string }).jobId;
      expect(await replayRun(runOne)).toMatchObject({
        state: 'completed',
        counts: { objects: 1, normalized: 1 },
      });
      expect(await replayRun(runTwo)).toMatchObject({
        state: 'completed',
        counts: { objects: 1, unchanged: 1 },
      });
      const events = await eventOf(webId);
      expect(events).toHaveLength(1);
      expect(events[0].unit_id).toBe(world.unitA2);
      const [exception] = await rows<{ state: string; replay_run_id: string }>(
        `SELECT state, replay_run_id FROM ingestion_exceptions WHERE id = $1`,
        [exceptionId],
      );
      expect(exception).toEqual({ state: 'resolved', replay_run_id: runOne });
      const raws = await rows<{
        id: string;
        replay_run_id: string | null;
        original_raw_id: string | null;
        outcome: string;
      }>(
        `SELECT id, replay_run_id, original_raw_id, outcome FROM raw_observations WHERE source_object_id = $1 ORDER BY received_at`,
        [webId],
      );
      expect(raws.map((raw) => [raw.replay_run_id, raw.outcome])).toEqual([
        [null, 'accepted'],
        [runOne, 'replayed'],
        [runTwo, 'replayed'],
      ]);
      expect(raws.slice(1).map((raw) => raw.original_raw_id)).toEqual([
        raws[0].id,
        raws[0].id,
      ]);
    });
  });

  describe('replay invariance (property)', () => {
    beforeAll(() => bind('EL-PROP', world.unitA3));

    it('any delivery order with duplicates, then a replay, ends in the same source objects and canonical facts', async () => {
      const objectVersions = fc.array(
        fc.uniqueArray(fc.integer({ min: 1, max: 50 }), {
          minLength: 1,
          maxLength: 3,
        }),
        { minLength: 1, maxLength: 3 },
      );
      const scenario = objectVersions.chain((objects) => {
        const deliveries = objects.flatMap((reads, object) =>
          reads.flatMap((readAt) => [
            { object, readAt },
            { object, readAt },
          ]),
        );
        return fc.tuple(
          fc.constant(objects),
          fc.shuffledSubarray(deliveries, { minLength: deliveries.length }),
        );
      });

      await fc.assert(
        fc.asyncProperty(scenario, async ([objects, deliveries]) => {
          const prefix = `EF-P-${randomUUID().slice(0, 8)}`;
          const versionOf = (object: number, readAt: number) =>
            envelopeOf(
              frame(`${prefix}-${object}`, 'EL-PROP', readAt + 60),
              readAt,
            );
          for (const { object, readAt } of deliveries)
            await deliver(versionOf(object, readAt));
          const expected = objects.map((reads, object) =>
            versionOf(object, Math.max(...reads)),
          );

          const settled = await snapshot(expected);
          const run = await app
            .get(ReplayService)
            .request(
              { tenantId: world.tenantA, userId: null } as never,
              binding.connectionId,
              {
                reason: 'property',
                sourceObjectIds: expected.map(
                  (envelope) => envelope.sourceObjectId,
                ),
              },
            );
          await app.get(ReplayService).runPending('property-runner');
          const replayed = await snapshot(expected);

          expect(settled).toEqual(
            expected.map((envelope) => ({
              hash: contentHashOf(envelope),
              end: envelope.endTime,
              events: 1,
            })),
          );
          expect(replayed).toEqual(settled);
          expect(
            await countRows(
              harness.dataSource,
              'replay_runs',
              `id = $1 AND state = 'completed'`,
              [run.id],
            ),
          ).toBe(1);
        }),
        { numRuns: 8 },
      );
    });

    /** Per expected object: latest source hash, canonical end time and number of canonical events. */
    const snapshot = (expected: CanonicalEnvelope[]) =>
      Promise.all(
        expected.map(async (envelope) => {
          const [object] = await rows<{ latest_hash: string }>(
            `SELECT latest_hash FROM source_objects WHERE source_object_id = $1`,
            [envelope.sourceObjectId],
          );
          const events = await eventOf(envelope.sourceObjectId);
          return {
            hash: object.latest_hash,
            end: events[0]?.end_time?.toISOString() ?? null,
            events: events.length,
          };
        }),
      );
  });
});
