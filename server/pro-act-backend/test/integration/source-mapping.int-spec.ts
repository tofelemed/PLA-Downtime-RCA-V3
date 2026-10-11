import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { AttributeMappingService } from '../../src/attribute-mapping/attribute-mapping.service';
import { HierarchyMappingModule } from '../../src/hierarchy-mapping/hierarchy-mapping.module';
import { HierarchyMappingService } from '../../src/hierarchy-mapping/hierarchy-mapping.service';
import { IntegrationModule } from '../../src/integration/integration.module';
import {
  FrameContext,
  PiFrameIngestService,
} from '../../src/integration/pi-frame-ingest.service';
import { ProductionEventModule } from '../../src/production-event/production-event.module';
import { SourceMappingService } from '../../src/source-mapping/source-mapping.service';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import { insertConnection } from './support/intake-fixtures';
import { at, EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

const DAY = '2026-09-10'; // fixed past date: never today, never the seed world's day
const t = (time: string) => at(time, DAY).toISOString();

interface PreviewBody {
  results: Array<{
    status: string;
    tier: string | null;
    unitId: string | null;
    candidates: unknown[];
  }>;
  summary: Record<string, number>;
}

/** Plan 1.3 (ING03): mapping precedence and ambiguity, legacy mirror, tenant isolation of mappings (T14 style). */
describe('source → plant mapping (plan 1.3)', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let admin: string;
  let adminB: string;
  let analyst: string;

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, {
      modules: [
        ProductionEventModule,
        V2Module,
        IntegrationModule,
        HierarchyMappingModule,
      ],
    });
    admin = signToken(app, {
      userId: randomUUID(),
      tenantId: world.tenantA,
      role: 'TenantAdmin',
    });
    adminB = signToken(app, {
      userId: randomUUID(),
      tenantId: world.tenantB,
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
  const createMapping = (body: Record<string, unknown>, token = admin) =>
    http()
      .post('/api/v2/source-mappings')
      .set(bearer(token))
      .set('Idempotency-Key', randomUUID())
      .send({ targetType: 'unit', ...body });
  const preview = (
    samples: Array<Record<string, unknown>>,
    token = admin,
    connectionId?: string,
  ) =>
    http()
      .post('/api/v2/source-mappings/preview')
      .set(bearer(token))
      .send(connectionId ? { connectionId, samples } : { samples })
      .expect(200);
  const findMapping = (sourceType: string, sourceIdentifier: string) =>
    http()
      .post('/api/hierarchy-mappings/find-mapping')
      .set(bearer(admin))
      .send({ sourceType, sourceIdentifier, tenantId: world.tenantA })
      .expect(201);
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

  describe('precedence: exact id > exact path > pattern > AF binding', () => {
    beforeAll(async () => {
      await createMapping({
        matchKind: 'exact_id',
        matchValue: 'EL-1',
        targetId: world.unitA1,
      }).expect(201);
      await createMapping({
        matchKind: 'exact_path',
        matchValue: '\\\\AF\\HDPE\\unit200',
        targetId: world.unitA2,
      }).expect(201);
      await createMapping({
        matchKind: 'pattern',
        matchValue: '\\\\AF\\HDPE\\unit3*',
        targetId: world.unitA3,
      }).expect(201);
      await bind('EL-BOUND', 'unit', world.unitA2);
    });

    it('resolves each sample at the expected tier', async () => {
      const response = await preview([
        {
          sourceId: 'EL-1',
          sourcePath: 'AF/HDPE/unit200',
          afElementWebIds: ['EL-BOUND'],
        },
        {
          sourceId: 'EL-X',
          sourcePath: '//af/hdpe/UNIT200/',
          afElementWebIds: ['EL-BOUND'],
        },
        {
          sourceId: 'EL-X',
          sourcePath: 'AF/HDPE/unit300/Pump',
          afElementWebIds: ['EL-BOUND'],
        },
        {
          sourceId: 'EL-X',
          sourcePath: 'AF/OTHER',
          afElementWebIds: ['EL-BOUND'],
        },
        { sourceId: 'EL-X' },
      ]);
      expect(
        json<PreviewBody>(response).results.map((r) => [r.tier, r.unitId]),
      ).toEqual([
        ['exact_id', world.unitA1],
        ['exact_path', world.unitA2],
        ['pattern', world.unitA3],
        ['af_binding', world.unitA2],
        [null, null],
      ]);
      expect(json<PreviewBody>(response).summary).toEqual({
        mapped: 4,
        ambiguous: 0,
        invalid_target: 0,
        unmapped: 1,
      });
    });

    it('quarantines a frame matched by two equal-precedence patterns', async () => {
      await createMapping({
        matchKind: 'pattern',
        matchValue: '*/unit300/*',
        targetId: world.unitA1,
      }).expect(201);
      const sample = await preview([
        { sourcePath: '\\\\AF\\HDPE\\unit300\\Pump' },
      ]);
      expect(json<PreviewBody>(sample).results[0]).toMatchObject({
        status: 'ambiguous',
        tier: 'pattern',
      });
      expect(json<PreviewBody>(sample).results[0].candidates).toHaveLength(2);

      const webId = `EF-${randomUUID()}`;
      const result = await app.get(PiFrameIngestService).ingest(
        await frameContext(),
        {
          WebId: webId,
          TemplateName: 'SOL Violation',
          StartTime: t('09:00'),
          EndTime: t('09:05'),
          PrimaryReferencedElement: {
            WebId: 'EL-PUMP',
            Path: '\\\\AF\\HDPE\\unit300\\Pump',
          },
        },
        {},
      );
      expect(result.outcome).toBe('unmapped');
      const [quarantined] = await rows<{ event_data: string }>(
        `SELECT event_data FROM unmapped_events WHERE source_id = $1`,
        [webId],
      );
      expect(JSON.parse(quarantined.event_data)).toMatchObject({
        status: 'ambiguous',
      });
      const events = await rows<unknown>(
        `SELECT 1 FROM production_events WHERE event_id = $1`,
        [webId],
      );
      expect(events).toHaveLength(0);
    });

    it('never resolves to a unit of another tenant (invalid_target)', async () => {
      await bind('EL-FOREIGN', 'unit', world.unitB1);
      const response = await preview([{ afElementWebIds: ['EL-FOREIGN'] }]);
      expect(json<PreviewBody>(response).results[0]).toMatchObject({
        status: 'invalid_target',
        unitId: null,
      });
    });
  });

  describe('tenant isolation and writes', () => {
    let mappingId: string;
    let etag: string;

    beforeAll(async () => {
      const created = await createMapping({
        matchKind: 'exact_id',
        matchValue: 'EL-ISO',
        targetId: world.unitA1,
      }).expect(201);
      mappingId = json<{ id: string }>(created).id;
      etag = created.headers.etag;
    });

    it('lists only the caller tenant rules and 404s foreign ids', async () => {
      const listB = await http()
        .get('/api/v2/source-mappings')
        .set(bearer(adminB))
        .expect(200);
      expect(json<{ items: unknown[] }>(listB).items).toEqual([]);
      await http()
        .get(`/api/v2/source-mappings/${mappingId}`)
        .set(bearer(adminB))
        .expect(404);
      await http()
        .put(`/api/v2/source-mappings/${mappingId}`)
        .set(bearer(adminB))
        .set('If-Match', etag)
        .send({
          matchKind: 'exact_id',
          matchValue: 'x',
          targetType: 'unit',
          targetId: world.unitB1,
        })
        .expect(404);
    });

    it('rejects a target of another tenant with 422 INVALID_REFERENCE', async () => {
      const response = await createMapping(
        { matchKind: 'exact_id', matchValue: 'EL-B', targetId: world.unitA1 },
        adminB,
      ).expect(422);
      expect(json<{ code: string }>(response).code).toBe('INVALID_REFERENCE');
    });

    it('needs an integration or manager role to write (403) and rejects duplicates (409)', async () => {
      await createMapping(
        { matchKind: 'exact_id', matchValue: 'EL-R', targetId: world.unitA1 },
        analyst,
      ).expect(403);
      const duplicate = await createMapping({
        matchKind: 'exact_id',
        matchValue: ' EL-ISO ',
        targetId: world.unitA2,
      }).expect(409);
      expect(json<{ code: string }>(duplicate).code).toBe('MAPPING_EXISTS');
    });

    it('replaces with If-Match and counts the version; stale tags are 412', async () => {
      const body = {
        matchKind: 'exact_id',
        matchValue: 'EL-ISO',
        targetType: 'asset',
        targetId: world.assetA1,
      };
      const replaced = await http()
        .put(`/api/v2/source-mappings/${mappingId}`)
        .set(bearer(admin))
        .set('If-Match', etag)
        .send(body)
        .expect(200);
      expect(json<unknown>(replaced)).toMatchObject({
        version: 2,
        targetType: 'asset',
      });
      await http()
        .put(`/api/v2/source-mappings/${mappingId}`)
        .set(bearer(admin))
        .set('If-Match', etag)
        .send(body)
        .expect(412);
    });

    it('mirrors v1 hierarchy mappings and keeps them v1-owned', async () => {
      const legacy = await app.get(HierarchyMappingService).create({
        sourceType: 'PI',
        sourceIdentifier: 'EL-LEGACY',
        sourcePath: '\\\\AF\\HDPE\\unit100\\Legacy',
        targetType: 'unit',
        targetId: world.unitA1,
        tenantId: world.tenantA,
      });
      const mirrored = await rows<{
        id: string;
        match_kind: string;
        normalized_value: string;
        row_version: number;
      }>(
        `SELECT id, match_kind, normalized_value, row_version FROM source_mappings WHERE legacy_mapping_id = $1 ORDER BY match_kind`,
        [legacy.id],
      );
      expect(
        mirrored.map((row) => [row.match_kind, row.normalized_value]),
      ).toEqual([
        ['exact_id', 'EL-LEGACY'],
        ['exact_path', 'af/hdpe/unit100/legacy'],
      ]);
      const response = await http()
        .put(`/api/v2/source-mappings/${mirrored[0].id}`)
        .set(bearer(admin))
        .set('If-Match', `"${mirrored[0].row_version}"`)
        .send({
          matchKind: 'exact_id',
          matchValue: 'EL-LEGACY',
          targetType: 'unit',
          targetId: world.unitA2,
        })
        .expect(409);
      expect(json<{ code: string }>(response).code).toBe('LEGACY_MAPPING');
      expect(
        await app.get(HierarchyMappingService).findHierarchyMapping({
          sourceType: 'PI',
          sourceIdentifier: 'nothing',
          sourcePath: 'af/hdpe/unit100/legacy',
          tenantId: world.tenantA,
        }),
      ).toMatchObject({ unitId: world.unitA1 });
    });

    it('resolves a mirrored MQTT mapping under its own source system (v1 lookup and v2 preview)', async () => {
      const topic = 'plant/line1/extruder';
      const legacy = app.get(HierarchyMappingService);
      await legacy.create({
        sourceType: 'MQTT',
        sourceIdentifier: topic,
        targetType: 'unit',
        targetId: world.unitA2,
        tenantId: world.tenantA,
      });
      await legacy.create({
        sourceType: 'PI',
        sourceIdentifier: 'EL-LEGACY-PI',
        targetType: 'unit',
        targetId: world.unitA1,
        tenantId: world.tenantA,
      });
      const found = async (sourceType: string, sourceIdentifier: string) =>
        json<{ unitId?: string }>(
          await findMapping(sourceType, sourceIdentifier),
        ).unitId;
      expect(await found('MQTT', topic)).toBe(world.unitA2);
      expect(await found('PI', 'EL-LEGACY-PI')).toBe(world.unitA1);
      expect(await found('PI', topic)).toBeUndefined();

      const mqttConnection = await insertConnection(
        harness.dataSource,
        world.tenantA,
        'mqtt',
      );
      const viaMqtt = await preview(
        [{ sourceId: topic }],
        admin,
        mqttConnection,
      );
      expect(json<PreviewBody>(viaMqtt).results[0]).toMatchObject({
        status: 'mapped',
        tier: 'exact_id',
        unitId: world.unitA2,
      });
      const viaPi = await preview([{ sourceId: topic }]);
      expect(json<PreviewBody>(viaPi).results[0]).toMatchObject({
        status: 'unmapped',
      });
    });
  });
});
