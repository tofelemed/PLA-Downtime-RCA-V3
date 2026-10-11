import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import * as mqtt from 'mqtt';
import * as path from 'path';
import * as request from 'supertest';
import { MqttAdapterModule } from '../../src/intake/adapters/mqtt/mqtt-adapter.module';
import { exampleMqttConfig } from '../../src/intake/adapters/mqtt/mqtt-config.example';
import { IntakeModule } from '../../src/intake/intake.module';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

/**
 * Plan 1.8 WP3 step 4: `POST /v2/connections/{id}/test` against the authenticated listeners of the
 * Compose broker (docker/mosquitto/mosquitto.conf): the password listener (host 1885) and the TLS
 * listener (host 8885, dev CA docker/mosquitto/certs/dev-ca.crt), plus the read-only ACL of the dev
 * subscriber user. Overrides: MQTT_TEST_AUTH_URL, MQTT_TEST_TLS_URL, MQTT_TEST_CA (PEM path),
 * MQTT_TEST_USERNAME / MQTT_TEST_PASSWORD (the read-only user; defaults are the committed dev-only pair).
 */
const AUTH_URL = process.env.MQTT_TEST_AUTH_URL ?? 'mqtt://localhost:1885';
const TLS_URL = process.env.MQTT_TEST_TLS_URL ?? 'mqtts://localhost:8885';
/** The same listener by IP: mqtt.js sends the host as SNI and verifies against it unless the host is an IP. */
const TLS_IP_URL = process.env.MQTT_TEST_TLS_IP_URL ?? 'mqtts://127.0.0.1:8885';
const CA_PATH =
  process.env.MQTT_TEST_CA ??
  path.resolve(__dirname, '../../../../docker/mosquitto/certs/dev-ca.crt');
const USERNAME = process.env.MQTT_TEST_USERNAME ?? 'proact-test';
const PASSWORD = process.env.MQTT_TEST_PASSWORD ?? 'proact-test-dev';
const WRONG_PASSWORD = `${PASSWORD}-wrong`;

type Overrides = Parameters<typeof exampleMqttConfig>[0];

interface ConnectionBody {
  id: string;
}

interface TestBody {
  connected: boolean;
  message: string;
  diagnostics: Record<string, unknown>;
}

describe('MQTT adapter test() on the authenticated Compose listeners (plan 1.8 step 4)', () => {
  const harness = new IntegrationHarness();
  const caPem = readFileSync(CA_PATH, 'utf8');
  let app: INestApplication;
  let admin: string;
  const http = () => request(app.getHttpServer());
  const authConfig = (overrides: Overrides = {}) =>
    exampleMqttConfig({
      ...overrides,
      mqtt: {
        brokerUrl: AUTH_URL,
        tls: undefined,
        username: USERNAME,
        connectTimeoutSeconds: 5,
        ...overrides.mqtt,
      },
    });
  const tlsConfig = (tls: Record<string, unknown>, brokerUrl = TLS_URL) =>
    exampleMqttConfig({
      mqtt: {
        brokerUrl,
        username: USERNAME,
        connectTimeoutSeconds: 5,
        tls,
      },
    });
  const create = async (
    config: Record<string, unknown>,
    secret: string,
  ): Promise<string> => {
    const response = await http()
      .post('/api/v2/connections')
      .set(bearer(admin))
      .set('Idempotency-Key', randomUUID())
      .send({
        sourceType: 'mqtt',
        displayName: `Auth ${randomUUID().slice(0, 8)}`,
        endpointConfig: config,
        secret,
      })
      .expect(201);
    return (response.body as ConnectionBody).id;
  };
  const test = async (id: string): Promise<TestBody> => {
    const response = await http()
      .post(`/api/v2/connections/${id}/test`)
      .set(bearer(admin))
      .expect(200);
    return response.body as TestBody;
  };

  beforeAll(async () => {
    await harness.start();
    app = await createIntegrationApp(harness, {
      modules: [IntakeModule, MqttAdapterModule, V2Module],
    });
    admin = signToken(app, {
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
    await harness.dataSource.query('DELETE FROM integration_connections');
    await harness.dataSource.query('DELETE FROM secrets');
  });

  describe('password listener', () => {
    it('connects with the right password', async () => {
      const id = await create(authConfig(), PASSWORD);
      const body = await test(id);
      expect(body.connected).toBe(true);
      expect(body.diagnostics).toMatchObject({
        connect: 'ok',
        username: USERNAME,
        tlsMode: 'none',
      });
      expect(JSON.stringify(body)).not.toContain(PASSWORD);
    });

    it.each([5, 4] as const)(
      'reports a wrong password as FAILED with the broker reason, non-retryable (MQTT protocol %d)',
      async (protocolVersion) => {
        const id = await create(
          authConfig({ mqtt: { protocolVersion } }),
          WRONG_PASSWORD,
        );
        const body = await test(id);
        expect(body.connected).toBe(false);
        // mosquitto 2.1 answers 0x87 NotAuthorized (3.1.1: return code 5); other brokers use 0x86
        expect(body.message).toMatch(
          /^Broker refused connection: (BadUserNameOrPassword|NotAuthorized)$/,
        );
        expect(body.diagnostics).toMatchObject({
          connect: 'refused',
          retryable: false,
          reasonCode: protocolVersion === 5 ? 0x87 : 5,
        });
        expect(JSON.stringify(body)).not.toContain(WRONG_PASSWORD);
      },
    );

    it('the read-only subscriber user may subscribe but not publish (ACL)', async () => {
      const client = mqtt.connect(AUTH_URL, {
        clientId: `test-acl-${randomUUID().slice(0, 8)}`,
        protocolVersion: 5,
        clean: true,
        reconnectPeriod: 0,
        connectTimeout: 5_000,
        username: USERNAME,
        password: PASSWORD,
        manualConnect: true,
      });
      await new Promise<void>((resolve, reject) => {
        client.once('connect', () => resolve());
        client.once('error', reject);
        client.connect();
      });
      try {
        const grants = await client.subscribeAsync('proact/v1/#', { qos: 1 });
        expect(grants.map((grant) => grant.qos)).toEqual([1]);
        await expect(
          client.publishAsync('proact/v1/acl-check', '{}', { qos: 1 }),
        ).rejects.toMatchObject({ code: 0x87 });
      } finally {
        await client.endAsync(true);
      }
    });
  });

  describe('TLS listener', () => {
    it('connects with the CA (tls.mode caPem)', async () => {
      const id = await create(tlsConfig({ mode: 'caPem', caPem }), PASSWORD);
      const body = await test(id);
      expect(body.connected).toBe(true);
      expect(body.diagnostics).toMatchObject({
        connect: 'ok',
        tlsMode: 'caPem',
      });
      expect(JSON.stringify(body)).not.toContain('BEGIN CERTIFICATE');
    });

    it('fails without the CA (tls.mode system) and points at the SAN / servername / CA settings', async () => {
      const id = await create(tlsConfig({ mode: 'system' }), PASSWORD);
      const body = await test(id);
      expect(body.connected).toBe(false);
      expect(body.message).toMatch(
        /^TLS handshake failed \((SELF_SIGNED_CERT_IN_CHAIN|UNABLE_TO_VERIFY_LEAF_SIGNATURE|DEPTH_ZERO_SELF_SIGNED_CERT)\): .*SAN does not list "localhost".*tls\.servername.*caPem/,
      );
      expect(body.diagnostics).toMatchObject({
        connect: 'tls',
        retryable: false,
        tlsMode: 'system',
      });
    });

    it('fails with the CA when tls.servername is not in the SAN (IP broker URL: for a DNS host mqtt.js verifies the host itself)', async () => {
      const id = await create(
        tlsConfig(
          { mode: 'caPem', caPem, servername: 'nothere.local' },
          TLS_IP_URL,
        ),
        PASSWORD,
      );
      const body = await test(id);
      expect(body.connected).toBe(false);
      expect(body.message).toContain(
        'TLS handshake failed (ERR_TLS_CERT_ALTNAME_INVALID)',
      );
      expect(body.message).toContain('"nothere.local"');
    });

    it('connects without verification in tls.mode insecure (dev only)', async () => {
      const id = await create(tlsConfig({ mode: 'insecure' }), PASSWORD);
      const body = await test(id);
      expect(body.connected).toBe(true);
      expect(body.diagnostics).toMatchObject({ tlsMode: 'insecure' });
    });
  });
});
