import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as mqtt from 'mqtt';
import * as request from 'supertest';
import { OutboxRelayService } from '../../../src/common/outbox/outbox-relay.service';
import { MqttSubscriberHost } from '../../../src/intake/adapters/mqtt/host/mqtt-subscriber-host';
import { SubscriptionHealth } from '../../../src/intake/adapters/mqtt/host/subscription-health';
import { MqttAdapterModule } from '../../../src/intake/adapters/mqtt/mqtt-adapter.module';
import { exampleMqttConfig } from '../../../src/intake/adapters/mqtt/mqtt-config.example';
import { IntegrationModule } from '../../../src/integration/integration.module';
import { ProductionEventModule } from '../../../src/production-event/production-event.module';
import { normalizeMatchValue } from '../../../src/source-mapping/mapping-rule';
import { V2Module } from '../../../src/v2/v2.module';
import { IntegrationHarness } from '../harness';
import { EventWorld, seedEventWorld } from './seed-event-world';
import { bearer, createIntegrationApp, signToken } from './test-app';

/** The Compose `mqtt` service (anonymous dev broker); `MQTT_TEST_URL` overrides it. */
export const BROKER_URL = process.env.MQTT_TEST_URL ?? 'mqtt://localhost:1884';

export interface SubscribeJobRow {
  id: string;
  state: string;
  lease_owner: string | null;
  next_run_at: Date | null;
  health: Record<string, unknown>;
  last_observation_at: Date | null;
}

type ConfigOverrides = Parameters<typeof exampleMqttConfig>[0];

export function waitFor(
  predicate: () => Promise<boolean> | boolean,
  what: string,
  timeoutMs = 15_000,
): Promise<void> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async (): Promise<void> => {
      if (await predicate()) return resolve();
      if (Date.now() - started > timeoutMs) {
        return reject(new Error(`timed out waiting for ${what}`));
      }
      setTimeout(() => void tick(), 50);
    };
    void tick();
  });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Plan 1.8 step 3 test world: the event world (tenant, units, reason codes), an app with the intake
 * core, the PI frame path, signals, the v2 API and the MQTT host (role `all`, timers inert: the tests
 * drive `reconcile()` / `heartbeat()` / the outbox relay themselves), and a QoS 1 publisher on the
 * Compose broker. Topics carry a per-run site so retained messages of earlier runs never interfere.
 */
export class MqttSubscriberWorld {
  readonly harness = new IntegrationHarness();
  readonly site = `S${randomUUID().slice(0, 8)}`;
  app!: INestApplication;
  world!: EventWorld;
  host!: MqttSubscriberHost;
  admin!: string;
  private publisher!: mqtt.MqttClient;
  private readonly retainedTopics = new Set<string>();

  async start(): Promise<void> {
    await this.harness.start();
    this.world = await seedEventWorld(this.harness.dataSource);
    this.app = await createIntegrationApp(this.harness, {
      modules: [
        ProductionEventModule,
        IntegrationModule,
        MqttAdapterModule,
        V2Module,
      ],
    });
    this.host = this.app.get(MqttSubscriberHost);
    this.admin = signToken(this.app, {
      userId: randomUUID(),
      tenantId: this.world.tenantA,
      role: 'TenantAdmin',
    });
    this.publisher = await connectPublisher();
  }

  async stop(): Promise<void> {
    for (const topic of this.retainedTopics) {
      await this.publisher.publishAsync(topic, '', { qos: 1, retain: true });
    }
    await this.publisher.endAsync();
    await this.app?.close();
    await this.harness.stop();
  }

  rows<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.harness.dataSource.query<T[]>(sql, params);
  }

  http(): request.Agent {
    return request(this.app.getHttpServer());
  }

  post(path: string, body: object = {}, token = this.admin): request.Test {
    return this.http()
      .post(`/api/v2/${path}`)
      .set(bearer(token))
      .set('Idempotency-Key', randomUUID())
      .send(body);
  }

  get(path: string, token = this.admin): request.Test {
    return this.http().get(`/api/v2/${path}`).set(bearer(token));
  }

  /** The reference configuration on the Compose broker, scoped to this run's site. */
  eventsConfig(overrides: ConfigOverrides = {}): Record<string, unknown> {
    return exampleMqttConfig({
      ...overrides,
      mqtt: {
        brokerUrl: BROKER_URL,
        tls: undefined,
        username: 'lab',
        sessionExpirySeconds: 300,
        topics: [`proact/v1/${this.site}/+/+/+/events`],
        availabilityTopic: `proact/v1/${this.site}/gateway/availability`,
        ...overrides.mqtt,
      },
    });
  }

  measurementsConfig(): Record<string, unknown> {
    return this.eventsConfig({
      mqtt: {
        topics: [`proact/v1/${this.site}/+/+/+/measurements/#`],
        availabilityTopic: undefined,
      },
      payloadProfile: {
        kind: 'measurement_json',
        topicTemplate:
          'proact/v1/{site}/{area}/{line}/{unit}/measurements/{attribute}',
        identityStrategy: 'seq_boot',
      },
    });
  }

  async createConnection(
    displayName: string,
    endpointConfig: Record<string, unknown>,
    secret?: string,
  ): Promise<string> {
    const response = await this.post('connections', {
      sourceType: 'mqtt',
      displayName,
      endpointConfig,
      ...(secret === undefined ? {} : { secret }),
    }).expect(201);
    return (response.body as { id: string }).id;
  }

  /** `PATCH /v2/connections/{id}` under the current `If-Match` (a secret or configuration change bumps the version). */
  async patchConnection(
    connectionId: string,
    body: Record<string, unknown>,
  ): Promise<{ configVersion: number }> {
    const current = await this.get(`connections/${connectionId}`).expect(200);
    const { rowVersion } = current.body as { rowVersion: number };
    const response = await this.http()
      .patch(`/api/v2/connections/${connectionId}`)
      .set(bearer(this.admin))
      .set('If-Match', `"${rowVersion}"`)
      .send(body)
      .expect(200);
    return response.body as { configVersion: number };
  }

  /** The audited actions of a job, oldest first. */
  async jobActions(jobId: string): Promise<string[]> {
    const rows = await this.rows<{ action: string }>(
      `SELECT action FROM ingestion_job_transitions WHERE job_id = $1 ORDER BY created_at, id`,
      [jobId],
    );
    return rows.map((row) => row.action);
  }

  /** Reconciles and waits for the connection's client to be connected and subscribed. */
  async startSubscription(connectionId: string): Promise<SubscribeJobRow> {
    await this.host.reconcile();
    await waitFor(() => {
      const health = this.health(connectionId);
      return health?.connected === true && health.subscribedTopics.length > 0;
    }, `connection ${connectionId} connected and subscribed`);
    await this.host.heartbeat();
    return this.job(connectionId);
  }

  health(connectionId: string): SubscriptionHealth | null {
    return this.host.healthOf(connectionId);
  }

  async job(connectionId: string): Promise<SubscribeJobRow> {
    const [row] = await this.rows<SubscribeJobRow>(
      `SELECT id, state, lease_owner, next_run_at, health, last_observation_at FROM ingestion_jobs
        WHERE connection_id = $1 AND scope->>'mode' = 'subscribe' ORDER BY created_at DESC LIMIT 1`,
      [connectionId],
    );
    return row;
  }

  async publish(
    topic: string,
    payload: unknown,
    options: { retain?: boolean } = {},
  ): Promise<void> {
    const body =
      typeof payload === 'string' || Buffer.isBuffer(payload)
        ? payload
        : JSON.stringify(payload);
    if (options.retain) this.retainedTopics.add(topic);
    await this.publisher.publishAsync(topic, body, {
      qos: 1,
      retain: options.retain ?? false,
    });
  }

  /** Publishes every pending outbox message (normalisation runs in-process). */
  async relay(): Promise<void> {
    const relay = this.app.get(OutboxRelayService);
    while ((await relay.relayBatch()).published > 0);
  }

  /** `source_mappings` row placing an element path on a unit for the MQTT source system. */
  async mapElement(path: string, unitId: string): Promise<void> {
    await this.rows(
      `INSERT INTO source_mappings (tenant_id, connection_id, source_system, match_kind, match_value, normalized_value,
              target_type, target_id, row_version)
       VALUES ($1, NULL, 'MQTT', 'exact_path', $2, $3, 'unit', $4, 1)`,
      [
        this.world.tenantA,
        path,
        normalizeMatchValue('exact_path', path),
        unitId,
      ],
    );
  }

  /** A rate signal in tonnes bound to `sourceKey` on the connection. */
  async registerSignal(
    connectionId: string,
    sourceKey: string,
    unitId: string,
  ): Promise<string> {
    const id = randomUUID();
    await this.rows(
      `INSERT INTO signals (id, tenant_id, row_version, connection_id, name, source_key, source_binding, unit_id,
              semantic_type, canonical_uom, rate_timebase, interpolation, max_gap_seconds, reset_policy,
              quality_policy, is_authority, effective_from, version)
       VALUES ($1, $2, 1, $3, $4::text, $4::text, '{}', $5, 'rate', 't', 'h', 'step', 3600, 'none', '{}', false, '2026-01-01T00:00:00Z', 1)`,
      [id, this.world.tenantA, connectionId, sourceKey, unitId],
    );
    return id;
  }

  async rawOutcomes(sourceObjectId: string): Promise<string[]> {
    const rows = await this.rows<{ outcome: string }>(
      `SELECT outcome FROM raw_observations WHERE source_object_id = $1 ORDER BY received_at, id`,
      [sourceObjectId],
    );
    return rows.map((row) => row.outcome);
  }

  async openExceptions(connectionId: string): Promise<
    Array<{
      error_code: string;
      source_object_id: string;
      occurrences: number;
      detail: Record<string, unknown>;
    }>
  > {
    return this.rows(
      `SELECT error_code, source_object_id, occurrences, detail FROM ingestion_exceptions
        WHERE connection_id = $1 AND state = 'open' ORDER BY first_seen`,
      [connectionId],
    );
  }
}

/** Contract §3.1 upsert message for `eventId` at `revision`; `end` null while open. */
export function eventMessage(input: {
  eventId: string;
  revision: string;
  elementPath: string;
  start: string;
  end: string | null;
  seq: number;
  attributes?: Record<string, unknown>;
  ts?: string;
}): Record<string, unknown> {
  return {
    schema_version: '1.0',
    event_id: input.eventId,
    revision: input.revision,
    operation: 'upsert',
    template: 'Production Loss',
    element_path: input.elementPath,
    start_ts: input.start,
    end_ts: input.end,
    attributes: input.attributes ?? {
      ReasonCode: 'Mechanical',
      Quantity: 12.5,
      Description: 'Conveyor belt tripped on overload',
    },
    attribute_units: { Quantity: 't' },
    ts: input.ts ?? input.revision,
    seq: input.seq,
    boot_id: 'gw-01-test',
    source: 'pi-mqtt-gw-01',
  };
}

/** A timestamp shortly before "now" (the profile rejects events older than 7 days or in the future). */
export function recentIso(minutesAgo: number): string {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

function connectPublisher(): Promise<mqtt.MqttClient> {
  const client = mqtt.connect(BROKER_URL, {
    clientId: `test-pub-${randomUUID().slice(0, 8)}`,
    clean: true,
    protocolVersion: 5,
    reconnectPeriod: 0,
    connectTimeout: 5_000,
    manualConnect: true,
  });
  return new Promise((resolve, reject) => {
    client.once('connect', () => resolve(client));
    client.once('error', reject);
    client.connect();
  });
}
