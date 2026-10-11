import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { MqttAdapterModule } from '../../src/intake/adapters/mqtt/mqtt-adapter.module';
import { exampleMqttConfig } from '../../src/intake/adapters/mqtt/mqtt-config.example';
import { IntakeModule } from '../../src/intake/intake.module';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

/** The Compose `mqtt` service (anonymous dev broker); `MQTT_TEST_URL` overrides it. */
const BROKER_URL = process.env.MQTT_TEST_URL ?? 'mqtt://localhost:1884';

type Overrides = Parameters<typeof exampleMqttConfig>[0];

interface ErrorBody {
  code: string;
  message: string;
  fieldErrors?: Array<{ field: string; message: string }>;
}

interface ConnectionBody {
  id: string;
  rowVersion: number;
  configVersion: number;
  hasSecret: boolean;
  effectiveClientId: string | null;
  endpointConfig: Record<string, unknown>;
  capabilities: Record<string, unknown>;
}

interface TestBody {
  connected: boolean;
  message: string;
  diagnostics: Record<string, unknown>;
}

/**
 * Plan 1.8 WP3 step 1: `POST /v2/connections` for `source_type = mqtt` (validation with field errors,
 * duplicate-feed guard, credential-neutral edits), `GET /discover` and `POST /test` against the Compose
 * broker. The persist-before-ack spike lives in `mqtt-persist-before-ack-spike.int-spec.ts`.
 */
describe('MQTT adapter API (plan 1.8 step 1)', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let admin: string;
  let foreign: string;
  const tenantId = randomUUID();
  const rows = <T>(sql: string, params: unknown[] = []): Promise<T[]> =>
    harness.dataSource.query<T[]>(sql, params);
  const http = () => request(app.getHttpServer());
  const post = (path: string, token: string, body: object) =>
    http()
      .post(`/api/v2/${path}`)
      .set(bearer(token))
      .set('Idempotency-Key', randomUUID())
      .send(body);
  /** The reference configuration pointed at the Compose broker (anonymous: user name only for form). */
  const labConfig = (overrides: Overrides = {}) =>
    exampleMqttConfig({
      ...overrides,
      mqtt: {
        brokerUrl: BROKER_URL,
        tls: undefined,
        username: 'lab',
        ...overrides.mqtt,
      },
    });
  /** The same broker, the disjoint `state` topic family with its own profile. */
  const stateFeed = (mqtt: Record<string, unknown> = {}) =>
    labConfig({
      mqtt: { topics: ['proact/v1/+/+/+/+/state'], ...mqtt },
      payloadProfile: {
        kind: 'state_json',
        topicTemplate: 'proact/v1/{site}/{area}/{line}/{unit}/state',
      },
    });
  const createMqtt = (
    displayName: string,
    config: Record<string, unknown>,
    extra: Record<string, unknown> = {},
    token = admin,
  ) =>
    post('connections', token, {
      sourceType: 'mqtt',
      displayName,
      endpointConfig: config,
      ...extra,
    });

  beforeAll(async () => {
    await harness.start();
    app = await createIntegrationApp(harness, {
      modules: [IntakeModule, MqttAdapterModule, V2Module],
    });
    admin = signToken(app, {
      userId: randomUUID(),
      tenantId,
      role: 'TenantAdmin',
    });
    foreign = signToken(app, {
      userId: randomUUID(),
      tenantId: randomUUID(),
      role: 'TenantAdmin',
    });
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  afterEach(async () => {
    delete process.env.CONNECTOR_EGRESS_ALLOWLIST;
    await rows('DELETE FROM integration_connections');
    await rows('DELETE FROM secrets');
  });

  const current = async (id: string) =>
    (
      await http()
        .get(`/api/v2/connections/${id}`)
        .set(bearer(admin))
        .expect(200)
    ).body as ConnectionBody;

  describe('POST /connections (mqtt)', () => {
    it('creates a connection with an mqtt_password secret and the adapter capabilities', async () => {
      const created = await createMqtt('Lab broker', labConfig(), {
        secret: 'lab-password',
      }).expect(201);
      const body = created.body as ConnectionBody;
      expect(body).toMatchObject({
        hasSecret: true,
        configVersion: 1,
        effectiveClientId: `proact-${body.id}`,
        capabilities: { replay: false, corrections: true, sequence: true },
      });
      expect(JSON.stringify(body)).not.toContain('lab-password');
      const [secret] = await rows<{ kind: string; ciphertext: string }>(
        `SELECT s.kind, s.ciphertext FROM secrets s JOIN integration_connections c ON c.secret_ref = 'secrets:' || s.id WHERE c.id = $1`,
        [body.id],
      );
      expect(secret.kind).toBe('mqtt_password');
      expect(secret.ciphertext).not.toContain('lab-password');

      const discovered = await http()
        .get(`/api/v2/connections/${body.id}/discover`)
        .set(bearer(admin))
        .expect(200);
      expect(discovered.body).toMatchObject({
        capabilities: { replay: false },
        metadata: {
          topics: [{ filter: 'proact/v1/+/+/+/+/events', qos: 1 }],
          payloadProfile: 'interval_event_json',
        },
      });
    });

    it.each<[string, Overrides, string]>([
      [
        'a bad broker URL',
        { mqtt: { brokerUrl: 'http://broker' } },
        'endpointConfig.mqtt.brokerUrl',
      ],
      [
        'a wildcard in the wrong place',
        { mqtt: { topics: ['a/#/b'] } },
        'endpointConfig.mqtt.topics[0]',
      ],
      ['qos 3', { mqtt: { qos: 3 } }, 'endpointConfig.mqtt.qos'],
      [
        'TLS trust on a plain broker',
        { mqtt: { tls: { mode: 'insecure' } } },
        'endpointConfig.mqtt.tls.mode',
      ],
      [
        'a template without the equipment capture',
        { payloadProfile: { topicTemplate: 'proact/v1/{site}/x/y/z/events' } },
        'endpointConfig.payloadProfile.topicTemplate',
      ],
    ])(
      'refuses %s with 422 INVALID_ENDPOINT_CONFIG and a field error',
      async (_name, overrides, field) => {
        const response = await createMqtt('Bad', labConfig(overrides)).expect(
          422,
        );
        const body = response.body as ErrorBody;
        expect(body.code).toBe('INVALID_ENDPOINT_CONFIG');
        expect(body.fieldErrors?.map((error) => error.field)).toContain(field);
      },
    );

    it('refuses a missing payload profile and credentials in the configuration', async () => {
      const missing = await createMqtt('No profile', {
        mqtt: labConfig().mqtt,
      }).expect(422);
      expect((missing.body as ErrorBody).fieldErrors).toEqual([
        { field: 'endpointConfig.payloadProfile', message: 'required object' },
      ]);
      const leaked = await createMqtt('Leak', {
        ...labConfig(),
        password: 'x',
      }).expect(422);
      expect((leaked.body as ErrorBody).code).toBe('SECRET_IN_CONFIG');
    });
  });

  describe('duplicate-feed guard', () => {
    it('refuses overlapping filters or the same client id on the same broker, within the tenant only', async () => {
      const first = await createMqtt('Line 1 events', labConfig()).expect(201);
      const firstId = (first.body as ConnectionBody).id;

      const overlapping = await createMqtt(
        'Line 1 again',
        labConfig({ mqtt: { topics: ['proact/v1/HDPE/#'] } }),
      ).expect(422);
      expect((overlapping.body as ErrorBody).code).toBe('DUPLICATE_FEED');
      expect((overlapping.body as ErrorBody).message).toContain(
        `"Line 1 events" (${firstId})`,
      );

      const sameId = await createMqtt(
        'Same id',
        stateFeed({ clientId: `proact-${firstId}` }),
      ).expect(422);
      expect((sameId.body as ErrorBody).code).toBe('DUPLICATE_FEED');

      await createMqtt('Line 1 state', stateFeed()).expect(201);
      await createMqtt(
        'Other broker',
        labConfig({ mqtt: { brokerUrl: 'mqtt://other.plant.local' } }),
      ).expect(201);
      await createMqtt('Inactive copy', labConfig(), {
        isActive: false,
      }).expect(201);
      await createMqtt('Other tenant', labConfig(), {}, foreign).expect(201);
    });

    it('applies on PATCH when the change introduces the overlap', async () => {
      await createMqtt('Line 1 events', labConfig()).expect(201);
      const second = await createMqtt('Line 1 state', stateFeed()).expect(201);
      const { id, rowVersion } = second.body as ConnectionBody;
      const patched = await http()
        .patch(`/api/v2/connections/${id}`)
        .set(bearer(admin))
        .set('If-Match', `"${rowVersion}"`)
        .send({
          endpointConfig: stateFeed({ topics: ['proact/v1/#'] }),
        })
        .expect(422);
      expect((patched.body as ErrorBody).code).toBe('DUPLICATE_FEED');
    });
  });

  describe('PATCH /connections/{id} credential binding', () => {
    it('lets topics change without the password but binds it to the broker URL', async () => {
      const created = await createMqtt('Lab broker', labConfig(), {
        secret: 'lab-password',
      }).expect(201);
      const { id, rowVersion } = created.body as ConnectionBody;
      const topics = await http()
        .patch(`/api/v2/connections/${id}`)
        .set(bearer(admin))
        .set('If-Match', `"${rowVersion}"`)
        .send({
          endpointConfig: labConfig({
            mqtt: {
              topics: ['proact/v1/+/+/+/+/events', 'proact/v1/+/+/+/+/state'],
            },
          }),
        })
        .expect(200);
      expect(topics.body as ConnectionBody).toMatchObject({
        configVersion: 2,
        hasSecret: true,
      });

      const moved = await http()
        .patch(`/api/v2/connections/${id}`)
        .set(bearer(admin))
        .set('If-Match', `"${(topics.body as ConnectionBody).rowVersion}"`)
        .send({
          endpointConfig: labConfig({
            mqtt: { brokerUrl: 'mqtt://other.plant.local' },
          }),
        })
        .expect(422);
      expect((moved.body as ErrorBody).code).toBe('SECRET_REQUIRED');
    });
  });

  describe('PATCH /connections/{id} payloadProfilePatch (plan 1.8 step 5)', () => {
    const patch = (id: string, rowVersion: number, body: object) =>
      http()
        .patch(`/api/v2/connections/${id}`)
        .set(bearer(admin))
        .set('If-Match', `"${rowVersion}"`)
        .send(body);

    it('merges value maps into the stored profile without the password; topics and fields survive', async () => {
      const created = await createMqtt(
        'Lab broker',
        labConfig({ mqtt: { clientId: 'proact-lab-1' } }),
        { secret: 'lab-password' },
      ).expect(201);
      const { id, rowVersion } = created.body as ConnectionBody;
      expect((created.body as ConnectionBody).effectiveClientId).toBe(
        'proact-lab-1',
      );
      const patched = await patch(id, rowVersion, {
        payloadProfilePatch: {
          valueMaps: { state: { RUN: 'running', STOP: 'stopped' } },
          time: { maxPastSeconds: 86_400 },
          fields: { bootId: null },
        },
      }).expect(200);
      const body = patched.body as ConnectionBody;
      expect(body).toMatchObject({ configVersion: 2, hasSecret: true });
      expect(body.endpointConfig.mqtt).toEqual(
        labConfig({ mqtt: { clientId: 'proact-lab-1' } }).mqtt,
      );
      expect(body.endpointConfig.payloadProfile).toEqual({
        ...(labConfig().payloadProfile as Record<string, unknown>),
        fields: { eventTime: 'ts', sequence: 'seq' },
        time: {
          unit: 'iso',
          maxFutureSkewSeconds: 300,
          maxPastSeconds: 86_400,
        },
        valueMaps: { state: { RUN: 'running', STOP: 'stopped' } },
      });
      expect(JSON.stringify(body)).not.toContain('lab-password');

      const unchanged = await patch(id, body.rowVersion, {
        payloadProfilePatch: { time: { maxPastSeconds: 86_400 } },
      }).expect(200);
      expect((unchanged.body as ConnectionBody).configVersion).toBe(2);
    });

    it('refuses a state map without running or stopped, an invalid merged profile, and the patch next to endpointConfig', async () => {
      const created = await createMqtt('Lab broker', labConfig()).expect(201);
      const { id, rowVersion } = created.body as ConnectionBody;
      const noRequired = await patch(id, rowVersion, {
        payloadProfilePatch: { valueMaps: { state: { RUN: 'idle' } } },
      }).expect(422);
      expect(noRequired.body as ErrorBody).toMatchObject({
        code: 'INVALID_ENDPOINT_CONFIG',
        fieldErrors: [
          {
            field: 'endpointConfig.payloadProfile.valueMaps.state',
            message: 'must map at least one token to running or stopped',
          },
        ],
      });
      const badTemplate = await patch(id, rowVersion, {
        payloadProfilePatch: { topicTemplate: 'other/{unit}/events' },
      }).expect(422);
      expect(
        (badTemplate.body as ErrorBody).fieldErrors?.map(
          (error) => error.field,
        ),
      ).toContain('endpointConfig.payloadProfile.topicTemplate');
      const both = await patch(id, rowVersion, {
        endpointConfig: labConfig(),
        payloadProfilePatch: {},
      }).expect(422);
      expect((both.body as ErrorBody).code).toBe('INVALID_CHANGE');
      expect((await current(id)).configVersion).toBe(1);
    });
  });

  describe('POST /connections/{id}/test against the Compose broker', () => {
    it.each([5, 4] as const)(
      'connects with MQTT protocol version %d using a throwaway client id',
      async (protocolVersion) => {
        const created = await createMqtt(
          `Lab v${protocolVersion}`,
          labConfig({ mqtt: { protocolVersion } }),
          // the dev broker is anonymous: the user name / password pair is sent and ignored
          { secret: 'unused-on-anonymous-broker' },
        ).expect(201);
        const tested = await http()
          .post(
            `/api/v2/connections/${(created.body as ConnectionBody).id}/test`,
          )
          .set(bearer(admin))
          .expect(200);
        const body = tested.body as TestBody;
        expect(body.connected).toBe(true);
        expect(body.message).toContain('Connected to');
        expect(body.diagnostics).toMatchObject({
          connect: 'ok',
          protocolVersion,
          sessionPresent: false,
          tlsMode: 'none',
        });
        expect(String(body.diagnostics.clientId)).toMatch(/^test-\d+$/);
        expect(JSON.stringify(body)).not.toContain(
          'unused-on-anonymous-broker',
        );
      },
    );

    it('reports an unreachable broker as FAILED with the socket error, within the connect timeout', async () => {
      const created = await createMqtt(
        'Nobody listens',
        labConfig({
          mqtt: { brokerUrl: 'mqtt://127.0.0.1:1', connectTimeoutSeconds: 2 },
        }),
      ).expect(201);
      const started = Date.now();
      const tested = await http()
        .post(`/api/v2/connections/${(created.body as ConnectionBody).id}/test`)
        .set(bearer(admin))
        .expect(200);
      expect(Date.now() - started).toBeLessThan(4_000);
      const body = tested.body as TestBody;
      expect(body.connected).toBe(false);
      expect(body.message).toMatch(/Broker unreachable: .*ECONNREFUSED/);
      expect(body.diagnostics).toMatchObject({
        connect: 'unreachable',
        retryable: true,
      });
    });

    it('reports a stored password without a user name instead of waiting for the connect timeout', async () => {
      const created = await createMqtt(
        'No user',
        labConfig({ mqtt: { username: undefined } }),
        { secret: 'orphan-password' },
      ).expect(201);
      const tested = await http()
        .post(`/api/v2/connections/${(created.body as ConnectionBody).id}/test`)
        .set(bearer(admin))
        .expect(200);
      expect(tested.body as TestBody).toMatchObject({
        connected: false,
        diagnostics: { prepare: 'PASSWORD_WITHOUT_USERNAME' },
      });
      expect(JSON.stringify(tested.body)).not.toContain('orphan-password');
    });

    it('refuses a broker outside CONNECTOR_EGRESS_ALLOWLIST without opening a socket', async () => {
      const created = await createMqtt('Lab broker', labConfig()).expect(201);
      process.env.CONNECTOR_EGRESS_ALLOWLIST = 'pi.plant.local';
      const tested = await http()
        .post(`/api/v2/connections/${(created.body as ConnectionBody).id}/test`)
        .set(bearer(admin))
        .expect(200);
      expect(tested.body as TestBody).toMatchObject({
        connected: false,
        diagnostics: { prepare: 'egress_denied' },
      });
      expect((tested.body as TestBody).message).toContain(
        'CONNECTOR_EGRESS_ALLOWLIST',
      );
    });
  });
});
