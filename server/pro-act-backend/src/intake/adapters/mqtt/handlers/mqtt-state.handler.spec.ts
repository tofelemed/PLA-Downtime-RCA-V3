import { DataSource, EntityManager } from 'typeorm';
import { RawObservation } from '../../../entities/raw-observation.entity';
import { NormalizationHandlerRegistry } from '../../../normalization/normalization-handler';
import { decodeMqttMessage } from '../profiles';
import { exampleDecodeConnection, examplePacket } from '../mqtt-decode.example';
import {
  MqttStateHandler,
  SOURCE_HEALTH_CHANGED,
  STATE_ENGINE_NOT_BUILT,
} from './mqtt-state.handler';

/** A manager that records SQL and entity inserts instead of touching a database. */
function fakeManager(): {
  manager: EntityManager;
  queries: Array<{ sql: string; params: unknown[] }>;
  inserted: unknown[];
} {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const inserted: unknown[] = [];
  const manager = {
    query: (sql: string, params: unknown[]) => {
      queries.push({ sql, params });
      return Promise.resolve([[], 0]);
    },
    insert: (_entity: unknown, rows: unknown[]) => {
      inserted.push(...rows);
      return Promise.resolve({ identifiers: rows.map((_, i) => ({ id: i })) });
    },
  } as unknown as EntityManager;
  return { manager, queries, inserted };
}

function envelopeOf(
  topic: string,
  payload: Record<string, unknown>,
  profile: Record<string, unknown> = {},
) {
  const availability = profile.kind === 'availability';
  const connection = exampleDecodeConnection({
    mqtt: {
      topics: [
        availability
          ? 'proact/v1/+/gateway/availability'
          : 'proact/v1/+/+/+/+/state',
      ],
    },
    payloadProfile: {
      kind: 'state_json',
      topicTemplate: 'proact/v1/{site}/{area}/{line}/{unit}/state',
      identityStrategy: 'seq_boot',
      ...profile,
    },
  });
  const result = decodeMqttMessage(
    examplePacket({ topic, payload, retained: true }, connection),
  );
  if (!result.ok) throw new Error(result.detail);
  return result.envelope;
}

describe('MqttStateHandler (plan 1.8 step 3, design §4.5)', () => {
  const { manager, queries, inserted } = fakeManager();
  const dataSource = {
    transaction: (work: (m: EntityManager) => Promise<unknown>) =>
      work(manager),
  } as unknown as DataSource;
  const registry = new NormalizationHandlerRegistry();
  const handler = new MqttStateHandler(registry, dataSource);
  handler.onModuleInit();
  const input = (envelope: ReturnType<typeof envelopeOf>) => ({
    raw: new RawObservation(),
    envelope,
    canonicalEventId: null,
  });

  beforeEach(() => {
    queries.length = 0;
    inserted.length = 0;
  });

  it('registers for mqtt state envelopes only', () => {
    const state = envelopeOf('proact/v1/HDPE/Polymer/Line1/Extruder1/state', {
      schema_version: '1.0',
      state: { name: 'RUN', value: 1 },
      ts: '2026-10-11T06:07:14.187Z',
      seq: 1,
      boot_id: 'gw',
    });
    expect(registry.find(state)?.name).toBe('mqtt-state');
    expect(handler.supports({ ...state, kind: 'measurement' })).toBe(false);
    expect(handler.supports({ ...state, sourceType: 'pi_web_api' })).toBe(
      false,
    );
  });

  it('parks a machine-state observation as no_handler with the 1.10 reason (by design)', async () => {
    const state = envelopeOf('proact/v1/HDPE/Polymer/Line1/Extruder1/state', {
      schema_version: '1.0',
      state: { name: 'RUN', value: 1 },
      ts: '2026-10-11T06:07:14.187Z',
      seq: 1843,
      boot_id: 'gw',
    });
    await expect(handler.handle(input(state))).resolves.toEqual({
      status: 'quarantined',
      outcome: 'no_handler',
      errorCode: 'no_handler',
      detail: {
        reason: STATE_ENGINE_NOT_BUILT,
        stateRef: 'proact/v1/HDPE/Polymer/Line1/Extruder1/state',
        value: 'RUN',
      },
    });
    expect(queries).toHaveLength(0);
  });

  it('turns a Last Will OFFLINE into source health (job health merge + SourceHealthChanged), never a stop', async () => {
    const offline = envelopeOf(
      'proact/v1/HDPE/gateway/availability',
      {
        schema_version: '1.0',
        state: 'OFFLINE',
        ts: '2026-10-11T06:09:59.000Z',
        boot_id: 'gw',
        pi_connected: false,
      },
      {
        kind: 'availability',
        topicTemplate: 'proact/v1/{site}/gateway/availability',
      },
    );
    const result = await handler.handle(input(offline));
    expect(result).toMatchObject({
      status: 'applied',
      outcome: 'source_unavailable',
      canonicalEventId: null,
    });
    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain('UPDATE "ingestion_jobs"');
    expect(queries[0].sql).toContain(`"scope"->>'mode'`);
    expect(JSON.parse(queries[0].params[2] as string)).toEqual({
      sourceAvailable: false,
      lastAvailabilityAt: '2026-10-11T06:09:59.000Z',
      sourcePiConnected: false,
    });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      type: SOURCE_HEALTH_CHANGED,
      aggregateType: 'integration_connection',
      aggregateId: offline.connectionId,
      tenantId: offline.tenantId,
      payload: {
        connectionId: offline.connectionId,
        available: false,
        piConnected: false,
        retained: true,
        topic: 'proact/v1/HDPE/gateway/availability',
      },
    });
  });
});
