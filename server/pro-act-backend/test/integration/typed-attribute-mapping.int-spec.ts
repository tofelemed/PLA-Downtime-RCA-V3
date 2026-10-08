import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { AttributeMappingService } from '../../src/attribute-mapping/attribute-mapping.service';
import { IntegrationModule } from '../../src/integration/integration.module';
import {
  FrameContext,
  PiEventFrame,
  PiFrameIngestService,
} from '../../src/integration/pi-frame-ingest.service';
import { ProductionEventModule } from '../../src/production-event/production-event.module';
import { SourceMappingService } from '../../src/source-mapping/source-mapping.service';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import { at, EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

const DAY = '2026-10-10';
const t = (time: string) => at(time, DAY).toISOString();

/** Plan 1.3 (ING04): T05 typed mapping, field catalog, versioned tenant overrides. */
describe('typed attribute mapping (plan 1.3, T05)', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let admin: string;
  let analyst: string;

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, {
      modules: [ProductionEventModule, V2Module, IntegrationModule],
    });
    admin = signToken(app, {
      userId: randomUUID(),
      tenantId: world.tenantA,
      role: 'TenantAdmin',
    });
    analyst = signToken(app, { userId: randomUUID(), tenantId: world.tenantA });
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  const http = () => request(app.getHttpServer());
  /** Typed view of a JSON body (supertest bodies are untyped). */
  const json = <T>(response: request.Response): T => response.body as T;
  const rows = <T>(sql: string, params: unknown[]): Promise<T[]> =>
    harness.dataSource.query<T[]>(sql, params);
  const bind = (
    webId: string,
    boundType: string,
    localId: string,
    tenantId = world.tenantA,
  ) =>
    harness.dataSource.query(
      `INSERT INTO af_bindings (tenant_id, web_id, local_id, bound_type, is_active) VALUES ($1, $2, $3, $4, true)`,
      [tenantId, webId, localId, boundType],
    );
  const frameContext = async (): Promise<FrameContext> => ({
    tenantId: world.tenantA,
    profile: await app
      .get(AttributeMappingService)
      .loadProfile(world.tenantA, null),
    resolver: await app
      .get(SourceMappingService)
      .loadResolver(world.tenantA, null),
  });

  describe('T05: typed mapping onto an asset binding', () => {
    let bearingId: string;
    const frame: PiEventFrame = {
      WebId: `EF-${randomUUID()}`,
      Name: 'Extruder stop',
      TemplateName: 'Production Loss',
      StartTime: t('08:00'),
      EndTime: t('08:20'),
      PrimaryReferencedElement: {
        WebId: 'EL-EXTRUDER',
        Path: '\\\\AF\\HDPE\\unit100\\Extruder',
      },
    };
    const attributes = {
      ReasonCode: { Name: 'Bearing', Value: 3, IsSystem: false },
      Duration: '00:15:00',
    };

    beforeAll(async () => {
      await bind('EL-EXTRUDER', 'asset', world.assetA1);
      const reason = await http()
        .post('/api/v2/reason-codes')
        .set(bearer(admin))
        .set('Idempotency-Key', randomUUID())
        .send({ code: 'BRG', name: 'Bearing' })
        .expect(201);
      bearingId = json<{ id: string }>(reason).id;
      await http()
        .post('/api/v2/attribute-mappings')
        .set(bearer(admin))
        .set('Idempotency-Key', randomUUID())
        .send({
          templateName: 'Production Loss',
          fieldRules: [
            {
              sourceAttr: 'Duration',
              targetField: 'suppliedDurationSeconds',
              type: 'duration',
              unit: 'timespan',
            },
          ],
        })
        .expect(201);
    });

    it('maps the digital state, the TimeSpan and derives the unit from the asset', async () => {
      const result = await app
        .get(PiFrameIngestService)
        .ingest(await frameContext(), frame, attributes);

      expect(result.outcome).toBe('created');
      expect(result.diagnostics).toEqual([
        expect.objectContaining({
          code: 'DURATION_MISMATCH',
          field: 'suppliedDurationSeconds',
        }),
      ]);
      const [event] = await rows<{ id: string }>(
        `SELECT id, unit_id, asset_id, reason_code_id, duration_seconds::int AS duration_seconds FROM production_events WHERE event_id = $1`,
        [frame.WebId],
      );
      expect(event).toMatchObject({
        unit_id: world.unitA1,
        asset_id: world.assetA1,
        reason_code_id: bearingId,
        duration_seconds: 1200,
      });
      const [revision] = await rows<{ source_facts: unknown }>(
        `SELECT source_facts FROM event_revisions WHERE event_id = $1 AND revision = 1`,
        [event.id],
      );
      expect(revision.source_facts).toMatchObject({
        reason: { name: 'Bearing', value: 3 },
        suppliedDurationSeconds: 900,
        mappingDiagnostics: [
          expect.objectContaining({ code: 'DURATION_MISMATCH' }),
        ],
      });
    });

    it('treats the identical redelivery as a duplicate (structured facts compare equal)', async () => {
      const result = await app
        .get(PiFrameIngestService)
        .ingest(await frameContext(), frame, attributes);
      expect(result.outcome).toBe('unchanged');
    });

    it('exposes the shared field catalog and the merged rules', async () => {
      const catalog = await http()
        .get('/api/v2/field-catalog')
        .set(bearer(analyst))
        .expect(200);
      expect(json<{ fields: unknown[] }>(catalog).fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'reason',
            resolvesTo: 'reasonCodeId',
          }),
        ]),
      );
      const effective = await http()
        .get('/api/v2/attribute-mappings')
        .set(bearer(analyst))
        .expect(200);
      const loss = json<
        Array<{ templateName: string; rules: unknown[]; override: unknown }>
      >(effective).find((entry) => entry.templateName === 'Production Loss');
      expect(loss?.override).toMatchObject({ version: 1 });
      expect(loss?.rules).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            targetField: 'suppliedDurationSeconds',
            unit: 'timespan',
          }),
          expect.objectContaining({
            targetField: 'quantity',
            sourceAttr: 'Quantity',
          }),
        ]),
      );
    });

    it('rejects rules the catalog does not allow (422)', async () => {
      const response = await http()
        .post('/api/v2/attribute-mappings')
        .set(bearer(admin))
        .set('Idempotency-Key', randomUUID())
        .send({
          templateName: 'Production Loss',
          fieldRules: [
            {
              sourceAttr: 'D',
              targetField: 'suppliedDurationSeconds',
              type: 'duration',
            },
          ],
        })
        .expect(422);
      expect(json<{ code: string }>(response).code).toBe('INVALID_FIELD_RULES');
    });
  });
});
