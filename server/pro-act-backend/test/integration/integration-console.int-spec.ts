import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { AdapterRegistry } from '../../src/intake/adapters/adapter-registry';
import { IntakeService } from '../../src/intake/intake.service';
import { NormalizationService } from '../../src/intake/normalization/normalization.service';
import { IntegrationModule } from '../../src/integration/integration.module';
import { piFrameEnvelope } from '../../src/integration/pi-envelope';
import { ProductionEventModule } from '../../src/production-event/production-event.module';
import { V2Module } from '../../src/v2/v2.module';
import {
  PiWebApiSimulator,
  SIM_PASSWORD,
  SIM_USERNAME,
} from '../simulators/pi-web-api/pi-web-api-simulator';
import { minutesAgo, simFrame } from '../simulators/pi-web-api/sim-fixtures';
import { IntegrationHarness } from './harness';
import { FakeAdapter } from './support/fake-adapter';
import { insertConnection } from './support/intake-fixtures';
import { usePiTestTimings } from './support/pi-certification';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

/** A past day that can never be today (quarantined test frame). */
const PAST = (minute: number) => new Date(Date.UTC(2026, 2, 2, 6, minute));

/**
 * Plan 3.7 backend additions for the integration console: PATCH /connections/{id} (write-only secret,
 * If-Match, configVersion), GET /connections/{id}/sample against the PI simulator, POST
 * /attribute-mappings/preview (TimeSpan → 900 s, draft rules) and the role-gated raw payload of an
 * ingestion exception.
 */
describe('integration console API (plan 3.7)', () => {
  const harness = new IntegrationHarness();
  const sim = new PiWebApiSimulator();
  let app: INestApplication;
  let world: EventWorld;
  let admin: string;
  let analyst: string;
  let foreign: string;
  let piConnection: string;
  const rows = <T>(sql: string, params: unknown[] = []): Promise<T[]> =>
    harness.dataSource.query<T[]>(sql, params);
  const http = () => request(app.getHttpServer());
  const post = (path: string, token: string, body: object) =>
    http()
      .post(`/api/v2/${path}`)
      .set(bearer(token))
      .set('Idempotency-Key', randomUUID())
      .send(body);

  beforeAll(async () => {
    usePiTestTimings();
    await harness.start();
    await sim.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, {
      modules: [ProductionEventModule, IntegrationModule, V2Module],
    });
    admin = signToken(app, {
      userId: randomUUID(),
      tenantId: world.tenantA,
      role: 'TenantAdmin',
    });
    analyst = signToken(app, { userId: randomUUID(), tenantId: world.tenantA });
    foreign = signToken(app, {
      userId: randomUUID(),
      tenantId: world.tenantB,
      role: 'TenantAdmin',
    });
    const created = await post('connections', admin, {
      sourceType: 'pi_web_api',
      displayName: 'Console simulator',
      endpointConfig: { piWebApiUrl: sim.baseUrl, username: SIM_USERNAME },
      secret: SIM_PASSWORD,
    }).expect(201);
    piConnection = (created.body as { id: string }).id;
  });

  afterAll(async () => {
    await app?.close();
    await sim.close();
    await harness.stop();
  });

  const current = async (id: string) =>
    (
      await http()
        .get(`/api/v2/connections/${id}`)
        .set(bearer(admin))
        .expect(200)
    ).body as { rowVersion: number; configVersion: number; hasSecret: boolean };

  describe('PATCH /connections/{id}', () => {
    it('needs If-Match, rejects stale revisions, writers only, foreign ids 404', async () => {
      const patch = (token: string, ifMatch?: string) => {
        const call = http()
          .patch(`/api/v2/connections/${piConnection}`)
          .set(bearer(token));
        return (ifMatch ? call.set('If-Match', ifMatch) : call).send({
          displayName: 'renamed',
        });
      };
      await patch(admin).expect(428);
      const { rowVersion } = await current(piConnection);
      await patch(admin, `"${rowVersion + 5}"`).expect(412);
      await patch(analyst, `"${rowVersion}"`).expect(403);
      await patch(foreign, `"${rowVersion}"`).expect(404);
    });

    it('replaces the secret write-only, bumps configVersion, rejects credentials in the config', async () => {
      const before = await current(piConnection);
      const response = await http()
        .patch(`/api/v2/connections/${piConnection}`)
        .set(bearer(admin))
        .set('If-Match', `"${before.rowVersion}"`)
        .send({ displayName: 'Console simulator', secret: 'rotated-test-only' })
        .expect(200);
      const body = response.body as {
        configVersion: number;
        hasSecret: boolean;
        rowVersion: number;
      };
      expect(JSON.stringify(body)).not.toContain('rotated-test-only');
      expect(body).toMatchObject({
        hasSecret: true,
        configVersion: before.configVersion + 1,
      });
      const [secret] = await rows<{ ciphertext: string }>(
        `SELECT s.ciphertext FROM secrets s JOIN integration_connections c ON c.secret_ref = 'secrets:' || s.id WHERE c.id = $1`,
        [piConnection],
      );
      expect(secret.ciphertext).not.toContain('rotated-test-only');

      const leaked = await http()
        .patch(`/api/v2/connections/${piConnection}`)
        .set(bearer(admin))
        .set('If-Match', `"${body.rowVersion}"`)
        .send({ endpointConfig: { piWebApiUrl: sim.baseUrl, token: 'x' } })
        .expect(422);
      expect((leaked.body as { code: string }).code).toBe('SECRET_IN_CONFIG');

      const restored = await http()
        .patch(`/api/v2/connections/${piConnection}`)
        .set(bearer(admin))
        .set('If-Match', `"${body.rowVersion}"`)
        .send({ secret: SIM_PASSWORD })
        .expect(200);
      expect((restored.body as { configVersion: number }).configVersion).toBe(
        before.configVersion + 2,
      );
    });
    it('requires the credential again when the endpoint target changes (422 SECRET_REQUIRED)', async () => {
      const before = await current(piConnection);
      const moved = await http()
        .patch(`/api/v2/connections/${piConnection}`)
        .set(bearer(admin))
        .set('If-Match', `"${before.rowVersion}"`)
        .send({
          endpointConfig: { piWebApiUrl: 'https://attacker.example/piwebapi' },
        })
        .expect(422);
      expect((moved.body as { code: string }).code).toBe('SECRET_REQUIRED');
      const insecure = await http()
        .patch(`/api/v2/connections/${piConnection}`)
        .set(bearer(admin))
        .set('If-Match', `"${before.rowVersion}"`)
        .send({
          endpointConfig: { piWebApiUrl: sim.baseUrl, allowInsecureTls: true },
        })
        .expect(422);
      expect((insecure.body as { code: string }).code).toBe('SECRET_REQUIRED');
      // both refusals leave the connection untouched (the sample test below still reaches the simulator)
    });
    it('refuses payloadProfilePatch on a non-MQTT connection (422 PROFILE_PATCH_UNSUPPORTED)', async () => {
      const { rowVersion, configVersion } = await current(piConnection);
      const refused = await http()
        .patch(`/api/v2/connections/${piConnection}`)
        .set(bearer(admin))
        .set('If-Match', `"${rowVersion}"`)
        .send({
          payloadProfilePatch: { valueMaps: { state: { RUN: 'running' } } },
        })
        .expect(422);
      expect(refused.body).toMatchObject({
        code: 'PROFILE_PATCH_UNSUPPORTED',
        fieldErrors: [{ field: 'payloadProfilePatch' }],
      });
      expect((await current(piConnection)).configVersion).toBe(configVersion);
    });

    it('refuses to edit a mirror of a v1 PI connection (409 LEGACY_CONNECTION)', async () => {
      const mirror = await insertConnection(
        harness.dataSource,
        world.tenantA,
        'pi_web_api',
      );
      await rows(
        `INSERT INTO pi_connections (id, tenant_id, connection_name, pi_web_api_url) VALUES ($1, $2, 'v1', 'http://127.0.0.1:9/piwebapi')`,
        [mirror, world.tenantA],
      );
      const response = await http()
        .patch(`/api/v2/connections/${mirror}`)
        .set(bearer(admin))
        .set('If-Match', '"1"')
        .send({ isActive: false })
        .expect(409);
      expect((response.body as { code: string }).code).toBe(
        'LEGACY_CONNECTION',
      );
    });
  });

  describe('GET /connections/{id}/sample', () => {
    const window = () => ({
      scopeType: 'database',
      scopeId: 'DB-HDPE',
      from: minutesAgo(120).toISOString(),
      to: new Date().toISOString(),
    });

    it('samples frames with attribute values and template counts; nothing is stored', async () => {
      sim.addElement('\\\\SIM-AF\\HDPE\\Console\\Unit9', 'EL-CONSOLE-9');
      sim.addFrames(
        ['EF-CS-1', 'EF-CS-2', 'EF-CS-3'].map((webId, index) =>
          simFrame({
            webId,
            start: minutesAgo(60 - index * 10),
            end: minutesAgo(45 - index * 10),
            template: index === 2 ? 'IOW Deviation' : 'Production Loss',
            element: {
              WebId: 'EL-CONSOLE-9',
              Path: '\\\\SIM-AF\\HDPE\\Console\\Unit9',
            },
            attributes: { Duration: '00:15:00', Quantity: 4 },
          }),
        ),
      );

      const response = await http()
        .get(`/api/v2/connections/${piConnection}/sample`)
        .query({ ...window(), limit: 2 })
        .set(bearer(admin))
        .expect(200);
      const body = response.body as {
        records: Array<{
          sourceObjectId: string;
          attributes: Record<string, unknown>;
          element: { webId: string };
          endTime: string | null;
        }>;
        templates: Array<{ name: string; records: number }>;
        truncated: boolean;
      };
      expect(body.records.map((record) => record.sourceObjectId)).toEqual([
        'EF-CS-1',
        'EF-CS-2',
      ]);
      expect(body.records[0].attributes).toMatchObject({
        Duration: '00:15:00',
        Quantity: 4,
      });
      expect(body.records[0].element.webId).toBe('EL-CONSOLE-9');
      expect(body.templates).toEqual([{ name: 'Production Loss', records: 2 }]);
      expect(body.truncated).toBe(true);
      const stored = await rows<{ count: string }>(
        `SELECT count(*) FROM raw_observations WHERE source_object_id LIKE 'EF-CS-%'`,
      );
      expect(Number(stored[0].count)).toBe(0);
    });

    it('validates the window and roles; source failures are 502 with the adapter code', async () => {
      const sample = (token: string, query: object) =>
        http()
          .get(`/api/v2/connections/${piConnection}/sample`)
          .query(query)
          .set(bearer(token));
      const reversed = await sample(admin, {
        ...window(),
        from: new Date().toISOString(),
        to: minutesAgo(5).toISOString(),
      }).expect(422);
      expect((reversed.body as { code: string }).code).toBe('INVALID_RANGE');
      await sample(analyst, window()).expect(403);
      await sample(foreign, window()).expect(404);

      sim.authRevoked = true;
      try {
        const denied = await sample(admin, window()).expect(502);
        expect((denied.body as { code: string }).code).toBe('PI_AUTH_FAILED');
        expect(JSON.stringify(denied.body)).not.toContain(SIM_PASSWORD);
      } finally {
        sim.authRevoked = false;
      }
    });

    it('is 422 SAMPLE_UNSUPPORTED for an adapter that cannot sample, ADAPTER_UNAVAILABLE without one', async () => {
      app.get(AdapterRegistry).register(new FakeAdapter());
      const codeOf = async (sourceType: 'mqtt' | 'rest_import') => {
        const id = await insertConnection(
          harness.dataSource,
          world.tenantA,
          sourceType,
        );
        const response = await http()
          .get(`/api/v2/connections/${id}/sample`)
          .query(window())
          .set(bearer(admin))
          .expect(422);
        return (response.body as { code: string }).code;
      };
      expect(await codeOf('rest_import')).toBe('SAMPLE_UNSUPPORTED');
      expect(await codeOf('mqtt')).toBe('ADAPTER_UNAVAILABLE');
    });
  });

  describe('POST /attribute-mappings/preview', () => {
    const sample = {
      templateName: 'Production Loss',
      attributes: { Duration: '00:15:00', Quantity: '12.5', ReasonCode: 'X' },
      startTime: PAST(0).toISOString(),
      endTime: PAST(15).toISOString(),
    };

    it('shows the default rule problem, then 900 s with a TimeSpan draft; viewers may preview', async () => {
      const defaults = await post('attribute-mappings/preview', analyst, {
        ...sample,
        connectionId: piConnection,
      }).expect(200);
      const plain = defaults.body as {
        diagnostics: Array<{ code: string }>;
        columns: Record<string, unknown>;
        durationSeconds: number;
      };
      expect(plain.diagnostics.map((entry) => entry.code)).toContain(
        'DURATION_UNPARSEABLE',
      );
      expect(plain.columns.quantity).toBe(12.5);
      expect(plain.durationSeconds).toBe(900);

      const drafted = await post('attribute-mappings/preview', analyst, {
        ...sample,
        fieldRules: [
          {
            sourceAttr: 'Duration',
            targetField: 'suppliedDurationSeconds',
            type: 'duration',
            unit: 'timespan',
          },
        ],
      }).expect(200);
      const body = drafted.body as {
        facts: Record<string, unknown>;
        diagnostics: unknown[];
        draftFields: string[];
        eventType: string;
      };
      expect(body.facts.suppliedDurationSeconds).toBe(900);
      expect(body.diagnostics).toEqual([]);
      expect(body.draftFields).toEqual(['suppliedDurationSeconds']);
      expect(body.eventType).toBe('ProductionLoss');
      const stored = await rows<{ count: string }>(
        `SELECT count(*) FROM attribute_mapping_versions WHERE tenant_id = $1`,
        [world.tenantA],
      );
      expect(Number(stored[0].count)).toBe(0);
    });

    it('rejects draft rules the catalog does not accept (422 INVALID_FIELD_RULES)', async () => {
      const response = await post('attribute-mappings/preview', admin, {
        ...sample,
        fieldRules: [
          {
            sourceAttr: 'Duration',
            targetField: 'suppliedDurationSeconds',
            type: 'duration',
          },
        ],
      }).expect(422);
      expect((response.body as { code: string }).code).toBe(
        'INVALID_FIELD_RULES',
      );
    });
  });

  describe('ingestion exception raw payload', () => {
    it('is visible (redacted of credential keys) to integration writers only', async () => {
      const binding = {
        tenantId: world.tenantA,
        connectionId: await insertConnection(
          harness.dataSource,
          world.tenantA,
          'pi_web_api',
        ),
      };
      const webId = `EF-CONSOLE-${randomUUID()}`;
      const envelope = piFrameEnvelope(
        binding,
        {
          frame: {
            WebId: webId,
            Name: 'lost',
            TemplateName: 'Production Loss',
            StartTime: PAST(0).toISOString(),
            EndTime: PAST(15).toISOString(),
            PrimaryReferencedElement: {
              WebId: 'EL-NOWHERE',
              Path: '\\\\AF\\X',
            },
          },
          attributes: { Duration: '00:15:00', ApiToken: 'not-for-display' },
        },
        { at: PAST(20), correlationId: 'console-test' },
      );
      const accepted = await app.get(IntakeService).accept(binding, envelope);
      if (accepted.ticket) {
        await app.get(NormalizationService).normalize(accepted.ticket);
      }
      const [exception] = await rows<{ id: string }>(
        `SELECT id FROM ingestion_exceptions WHERE source_object_id = $1`,
        [webId],
      );
      const detail = (token: string) =>
        http()
          .get(`/api/v2/ingestion-exceptions/${exception.id}`)
          .set(bearer(token))
          .expect(200);

      const forAnalyst = (await detail(analyst)).body as {
        errorCode: string;
        raw: { payloadVisible: boolean; payload: unknown };
      };
      expect(forAnalyst.errorCode).toBe('unknown_unit');
      expect(forAnalyst.raw).toMatchObject({
        payloadVisible: false,
        payload: null,
      });
      const forAdmin = (await detail(admin)).body as {
        raw: { payloadVisible: boolean; payload: unknown };
      };
      expect(forAdmin.raw.payloadVisible).toBe(true);
      const text = JSON.stringify(forAdmin.raw.payload);
      expect(text).toContain(webId);
      expect(text).toContain('[redacted]');
      expect(text).not.toContain('not-for-display');
    });
  });
});
