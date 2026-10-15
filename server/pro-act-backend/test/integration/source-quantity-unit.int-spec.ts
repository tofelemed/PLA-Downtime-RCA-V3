import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Server } from 'http';
import * as request from 'supertest';
import { AttributeMappingService } from '../../src/attribute-mapping/attribute-mapping.service';
import { IntegrationModule } from '../../src/integration/integration.module';
import { PiFrameIngestService } from '../../src/integration/pi-frame-ingest.service';
import { mqttFrameOf } from '../../src/intake/adapters/mqtt/handlers/mqtt-frame';
import { MqttAdapterModule } from '../../src/intake/adapters/mqtt/mqtt-adapter.module';
import {
  exampleDecodeConnection,
  examplePacket,
} from '../../src/intake/adapters/mqtt/mqtt-decode.example';
import { decodeMqttMessage } from '../../src/intake/adapters/mqtt/profiles';
import { CanonicalEnvelope } from '../../src/intake/envelope/canonical-envelope';
import { IntakeService } from '../../src/intake/intake.service';
import { NormalizationService } from '../../src/intake/normalization/normalization.service';
import { ReplayService } from '../../src/intake/replay/replay.service';
import { ProductionEventModule } from '../../src/production-event/production-event.module';
import { normalizeMatchValue } from '../../src/source-mapping/mapping-rule';
import { SourceMappingService } from '../../src/source-mapping/source-mapping.service';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import { insertConnection } from './support/intake-fixtures';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

const ELEMENT = '\\\\PIAF\\HDPE\\unit100\\Extruder1';
const at = (second: number) =>
  new Date(Date.UTC(2026, 9, 15, 6, 0, second)).toISOString();

describe('source quantity unit through MQTT normalization and replay', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let connectionId: string;
  let admin: string;
  const rows = <T>(sql: string, params: unknown[] = []): Promise<T[]> =>
    harness.dataSource.query<T[]>(sql, params);
  const event = async (id: string) =>
    (
      await rows<{ id: string; quantity: string; quantity_uom: string | null }>(
        'SELECT id,quantity::text,quantity_uom FROM production_events WHERE event_id=$1',
        [id],
      )
    )[0];

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, {
      modules: [
        ProductionEventModule,
        IntegrationModule,
        MqttAdapterModule,
        V2Module,
      ],
    });
    connectionId = await insertConnection(
      harness.dataSource,
      world.tenantA,
      'mqtt',
    );
    admin = signToken(app, {
      userId: randomUUID(),
      tenantId: world.tenantA,
      role: 'TenantAdmin',
    });
    await rows(
      `INSERT INTO source_mappings (tenant_id,source_system,match_kind,match_value,
      normalized_value,target_type,target_id,row_version) VALUES ($1,'MQTT','exact_path',$2,$3,'unit',$4,1)`,
      [
        world.tenantA,
        ELEMENT,
        normalizeMatchValue('exact_path', ELEMENT),
        world.unitA1,
      ],
    );
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  function envelope(
    id: string,
    revision: number,
    data: {
      attributes: Record<string, unknown>;
      units?: Record<string, string>;
      template?: string;
    },
  ): CanonicalEnvelope {
    const decoded = decodeMqttMessage(
      examplePacket(
        {
          topic: 'proact/v1/HDPE/Polymer/unit100/Extruder1/events',
          receivedAt: at(revision),
          payload: {
            schema_version: '1.0',
            event_id: id,
            revision: at(revision),
            operation: 'upsert',
            template: data.template ?? 'Production Loss',
            element_path: ELEMENT,
            start_ts: at(0),
            end_ts: null,
            attributes: data.attributes,
            attribute_units: data.units,
            ts: at(revision),
            seq: revision,
            boot_id: 'quantity-unit-test',
          },
        },
        { ...exampleDecodeConnection(), tenantId: world.tenantA, connectionId },
      ),
    );
    if (!decoded.ok) throw new Error(decoded.detail);
    return decoded.envelope;
  }

  async function normalize(candidate: CanonicalEnvelope): Promise<void> {
    const accepted = await app
      .get(IntakeService)
      .accept({ tenantId: world.tenantA, connectionId }, candidate);
    if (!accepted.ticket)
      throw new Error('No normalization ticket: ' + accepted.status);
    const result = await app
      .get(NormalizationService)
      .normalize(accepted.ticket);
    expect(result).toMatchObject({
      status: 'processed',
      result: { status: 'applied' },
    });
  }

  async function replay(id: string): Promise<void> {
    const response = await request(app.getHttpServer() as Server)
      .post(`/api/v2/connections/${connectionId}/replays`)
      .set(bearer(admin))
      .set('Idempotency-Key', randomUUID())
      .send({
        reason: 'Verify quantity source metadata recovery',
        sourceObjectIds: [`Extruder1:${id}`],
      })
      .expect(202);
    await app.get(ReplayService).runPending('quantity-unit-test');
    const body = response.body as { jobId: string };
    const [run] = await rows<{ state: string; counts: Record<string, number> }>(
      'SELECT state,counts FROM replay_runs WHERE id=$1',
      [body.jobId],
    );
    expect(run).toMatchObject({
      state: 'completed',
      counts: { objects: 1, failed: 0, quarantined: 0 },
    });
  }

  it('persists an explicit unit on creation and in the source/effective revision snapshots', async () => {
    const id = randomUUID();
    await normalize(
      envelope(id, 1, {
        attributes: { Quantity: 9.6 },
        units: { Quantity: 't' },
      }),
    );
    const stored = await event(id);
    expect(stored.quantity_uom).toBe('t');
    expect(Number(stored.quantity)).toBe(9.6);
    const [revision] = await rows<{
      source_facts: unknown;
      effective_facts: unknown;
    }>(
      'SELECT source_facts,effective_facts FROM event_revisions WHERE event_id=$1 ORDER BY revision DESC LIMIT 1',
      [stored.id],
    );
    expect(revision.source_facts).toMatchObject({
      quantity: 9.6,
      quantityUom: 't',
    });
    expect(revision.effective_facts).toMatchObject({
      quantity: 9.6,
      quantityUom: 't',
    });
  });

  it('updates an explicit unit and clears it when a later source value has no unit', async () => {
    const id = randomUUID();
    await normalize(
      envelope(id, 1, {
        attributes: { Quantity: 9.6 },
        units: { Quantity: 't' },
      }),
    );
    await normalize(
      envelope(id, 2, {
        attributes: { Quantity: 9600 },
        units: { Quantity: 'kg' },
      }),
    );
    expect((await event(id)).quantity_uom).toBe('kg');
    await normalize(envelope(id, 3, { attributes: { Quantity: 10.2 } }));
    expect((await event(id)).quantity_uom).toBeNull();
    expect(Number((await event(id)).quantity)).toBe(10.2);
  });

  it('uses the unit of the selected primary quantity, never the ignored alias', async () => {
    const id = randomUUID();
    await normalize(
      envelope(id, 1, {
        template: 'Production Output',
        attributes: { GoodQty: 9600, Quantity: 9.6 },
        units: { GoodQty: 'kg', Quantity: 't' },
      }),
    );
    expect((await event(id)).quantity_uom).toBe('kg');
    expect(Number((await event(id)).quantity)).toBe(9600);
  });

  it('leaves the unit null when the source has never supplied one', async () => {
    const id = randomUUID();
    await normalize(envelope(id, 1, { attributes: { Quantity: 9.6 } }));
    expect((await event(id)).quantity_uom).toBeNull();
  });

  it('repairs an earlier unitless canonical event through scoped public replay without duplicating it', async () => {
    const id = randomUUID();
    const candidate = envelope(id, 1, {
      attributes: { Quantity: 9.6 },
      units: { Quantity: 't' },
    });
    await app
      .get(IntakeService)
      .accept({ tenantId: world.tenantA, connectionId }, candidate);
    const { frame } = mqttFrameOf(candidate);
    // Simulate the earlier normalizer's scalar input; retain the original envelope with its unit.
    await app.get(PiFrameIngestService).ingest(
      {
        tenantId: world.tenantA,
        sourceSystem: 'MQTT',
        profile: await app
          .get(AttributeMappingService)
          .loadProfile(world.tenantA, connectionId),
        resolver: await app
          .get(SourceMappingService)
          .loadResolver(world.tenantA, connectionId, new Date(), 'MQTT'),
      },
      frame,
      { Quantity: 9.6 },
    );
    const before = await event(id);
    expect(before.quantity_uom).toBeNull();
    await replay(id);
    expect(await event(id)).toMatchObject({ id: before.id, quantity_uom: 't' });
    const [revisionCount] = await rows<{ count: number }>(
      'SELECT count(*)::int AS count FROM event_revisions WHERE event_id=$1',
      [before.id],
    );
    await replay(id);
    const [afterCount] = await rows<{ count: number }>(
      'SELECT count(*)::int AS count FROM event_revisions WHERE event_id=$1',
      [before.id],
    );
    expect(afterCount.count).toBe(revisionCount.count);
    expect(
      (await rows('SELECT id FROM production_events WHERE event_id=$1', [id]))
        .length,
    ).toBe(1);
  });
});
