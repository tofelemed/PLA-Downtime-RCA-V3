import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AttributeMappingService } from '../../src/attribute-mapping/attribute-mapping.service';
import { OutboxRelayService } from '../../src/common/outbox/outbox-relay.service';
import { CanonicalEnvelope } from '../../src/intake/envelope/canonical-envelope';
import { IntakeService } from '../../src/intake/intake.service';
import { IntakeBinding } from '../../src/intake/intake.types';
import { NormalizationService } from '../../src/intake/normalization/normalization.service';
import { IntegrationModule } from '../../src/integration/integration.module';
import { piFrameEnvelope } from '../../src/integration/pi-envelope';
import { PiEventFrame } from '../../src/integration/pi-frame-ingest.service';
import {
  PiIntakeBridge,
  PiPullScope,
} from '../../src/integration/pi-intake-bridge';
import { ProductionEventModule } from '../../src/production-event/production-event.module';
import { EventRevisionService } from '../../src/production-event/revisions/event-revision.service';
import { SourceMappingService } from '../../src/source-mapping/source-mapping.service';
import { IntegrationHarness } from './harness';
import { countRows, insertConnection } from './support/intake-fixtures';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { createIntegrationApp } from './support/test-app';

const minute = (value: number) => new Date(Date.UTC(2026, 9, 8, 6, value));

/** Plan 1.5: the PI pull path inside the durable pipeline, transactional event outbox, retraction. */
describe('PI frames through the durable intake (plan 1.5)', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let binding: IntakeBinding;
  const rows = <T>(sql: string, params: unknown[] = []): Promise<T[]> =>
    harness.dataSource.query<T[]>(sql, params);

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, {
      modules: [ProductionEventModule, IntegrationModule],
    });
    binding = {
      tenantId: world.tenantA,
      connectionId: await insertConnection(
        harness.dataSource,
        world.tenantA,
        'pi_web_api',
      ),
    };
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

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

  describe('the PI pull path (raw store → canonical event → source revision)', () => {
    let pull: PiPullScope;
    const webId = `EF-${randomUUID()}`;

    beforeAll(async () => {
      await bind('EL-PULL', world.unitA1);
      pull = {
        context: {
          tenantId: world.tenantA,
          profile: await app
            .get(AttributeMappingService)
            .loadProfile(world.tenantA, null),
          resolver: await app
            .get(SourceMappingService)
            .loadResolver(world.tenantA, null),
        },
        connectionId: binding.connectionId,
        correlationId: 'pull-test',
      };
    });

    it('creates, skips the unchanged re-read, revises on change; the later relay delivery has no effect', async () => {
      const bridge = app.get(PiIntakeBridge);

      const created = await bridge.ingestFrame(
        pull,
        frame(webId, 'EL-PULL', null),
        {},
      );
      const reread = await bridge.ingestFrame(
        pull,
        frame(webId, 'EL-PULL', null),
        {},
      );
      const closed = await bridge.ingestFrame(
        pull,
        frame(webId, 'EL-PULL', 30),
        {},
      );

      expect([created.outcome, reread.outcome, closed.outcome]).toEqual([
        'created',
        'unchanged',
        'updated',
      ]);
      const [event] = await eventOf(webId);
      expect(event).toMatchObject({
        unit_id: world.unitA1,
        end_time: minute(30),
      });
      expect(
        await countRows(
          harness.dataSource,
          'raw_observations',
          'source_object_id = $1',
          [webId],
        ),
      ).toBe(2);
      const revisions = () =>
        countRows(harness.dataSource, 'event_revisions', 'event_id = $1', [
          event.id,
        ]);
      expect(await revisions()).toBe(2);
      const changes = await rows<{ type: string; version: number }>(
        `SELECT type, version FROM outbox WHERE aggregate_id = $1 ORDER BY id`,
        [event.id],
      );
      expect(changes).toEqual([
        { type: 'EventChanged', version: 1 },
        { type: 'EventChanged', version: 2 },
      ]);

      while ((await app.get(OutboxRelayService).relayBatch()).published > 0);
      expect(await revisions()).toBe(2);
      expect(
        await countRows(harness.dataSource, 'outbox', `state <> 'published'`),
      ).toBe(0);
    });

    it('quarantines an unplaceable frame (unknown_unit) and mirrors it into unmapped_events', async () => {
      const lost = `EF-${randomUUID()}`;

      const result = await app
        .get(PiIntakeBridge)
        .ingestFrame(pull, frame(lost, 'EL-NOWHERE', 10), {});

      expect(result.outcome).toBe('unmapped');
      expect(await eventOf(lost)).toEqual([]);
      const [exception] = await rows<{ error_code: string; state: string }>(
        `SELECT error_code, state FROM ingestion_exceptions WHERE source_object_id = $1`,
        [lost],
      );
      expect(exception).toEqual({ error_code: 'unknown_unit', state: 'open' });
      expect(
        await countRows(
          harness.dataSource,
          'unmapped_events',
          'source_id = $1',
          [lost],
        ),
      ).toBe(1);
    });

    it('writes event messages to the outbox only when the revision commits', async () => {
      const [event] = await eventOf(webId);
      const before = await countRows(
        harness.dataSource,
        'outbox',
        'aggregate_id = $1',
        [event.id],
      );
      const change = {
        actor: { id: randomUUID(), kind: 'user' as const },
        eventId: event.id,
        patch: { description: 'edited' },
      };

      await expect(
        app
          .get(EventRevisionService)
          .applyUserChange({ ...change, expectedRowVersion: -1 }),
      ).rejects.toMatchObject({ status: 412 });
      expect(
        await countRows(harness.dataSource, 'outbox', 'aggregate_id = $1', [
          event.id,
        ]),
      ).toBe(before);

      await app.get(EventRevisionService).applyUserChange(change);
      expect(
        await countRows(harness.dataSource, 'outbox', 'aggregate_id = $1', [
          event.id,
        ]),
      ).toBe(before + 1);
    });

    it('a source retraction tombstones the canonical event (EventRetracted)', async () => {
      const [event] = await eventOf(webId);
      const retraction: CanonicalEnvelope = {
        ...envelopeOf(frame(webId, 'EL-PULL', 30), 90),
        // the pull path observed the frame at read time (now): the retraction comes later
        observedAt: new Date(Date.now() + 60_000).toISOString(),
        messageId: `${webId}:retract`,
        operation: 'retract',
        kind: 'retraction',
        sourceRevision: 'deleted-in-pi',
        retraction: { reason: 'frame deleted' },
      };

      const outcome = await deliver(retraction);

      expect(outcome).toMatchObject({
        status: 'processed',
        result: { outcome: 'retracted' },
      });
      expect((await eventOf(webId))[0].physical_state).toBe('retracted');
      expect(
        await countRows(
          harness.dataSource,
          'outbox',
          `aggregate_id = $1 AND type = 'EventRetracted'`,
          [event.id],
        ),
      ).toBe(1);
    });
  });
});
