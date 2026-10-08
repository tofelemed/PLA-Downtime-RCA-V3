import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { ProductionEventModule } from '../../src/production-event/production-event.module';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import { at, EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

interface CodeBody {
  id: string;
  code: string;
  parentId: string | null;
  path: string;
  level: number;
  version: number;
  active: boolean;
}

interface CodeList {
  items: CodeBody[];
}

interface ErrorBody {
  code: string;
}

interface IdBody {
  id: string;
}

interface EventBody {
  id: string;
  classification: { scheduleClass: string };
  classificationBasis: Record<string, unknown> | null;
}

/** Plan 1.3: T18 reason hierarchy, per-tenant uniqueness, versioned code mapping rules, tenant isolation. */
describe('code libraries (plan 1.3)', () => {
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
      modules: [ProductionEventModule, V2Module],
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
  const post = (path: string, body: Record<string, unknown>, token = admin) =>
    http()
      .post(`/api/v2/${path}`)
      .set(bearer(token))
      .set('Idempotency-Key', randomUUID())
      .send(body);
  const create = async (
    body: Record<string, unknown>,
    library = 'reason-codes',
  ): Promise<CodeBody> => json<CodeBody>(await post(library, body).expect(201));
  const change = (id: string, version: number, body: Record<string, unknown>) =>
    http()
      .put(`/api/v2/reason-codes/${id}`)
      .set(bearer(admin))
      .set('If-Match', `"${version}"`)
      .send(body);

  describe('T18: reason hierarchy', () => {
    let root: CodeBody;
    let child: CodeBody;
    let leaf: CodeBody;

    beforeAll(async () => {
      root = await create({ code: 'MECH', name: 'Mechanical' });
      child = await create({
        code: 'MECH.BRG',
        name: 'Bearing',
        parentId: root.id,
      });
      leaf = await create({
        code: 'MECH.BRG.OVH',
        name: 'Overheating',
        parentId: child.id,
      });
    });

    it('persists a three-level tree and reloads it identically', async () => {
      expect(leaf).toMatchObject({
        level: 2,
        path: `${root.id}/${child.id}/${leaf.id}`,
        version: 1,
      });
      const reload = async () =>
        json<CodeList>(
          await http()
            .get(`/api/v2/reason-codes?parentId=${child.id}`)
            .set(bearer(analyst))
            .expect(200),
        ).items;
      const first = await reload();
      expect(first).toEqual([
        expect.objectContaining({ id: leaf.id, parentId: child.id, level: 2 }),
      ]);
      expect(await reload()).toEqual(first);
      const roots = await http()
        .get('/api/v2/reason-codes?rootsOnly=true')
        .set(bearer(analyst))
        .expect(200);
      expect(json<CodeList>(roots).items.map((item) => item.code)).toContain(
        'MECH',
      );
    });

    it('rejects a cycle with 422 CODE_CYCLE', async () => {
      const response = await change(root.id, 1, { parentId: leaf.id }).expect(
        422,
      );
      expect(json<ErrorBody>(response).code).toBe('CODE_CYCLE');
      await change(root.id, 1, { parentId: root.id }).expect(422);
    });

    it('moves a subtree and re-paths the descendants', async () => {
      const other = await create({ code: 'ELEC', name: 'Electrical' });
      const moved = await change(child.id, 1, { parentId: other.id }).expect(
        200,
      );
      expect(json<unknown>(moved)).toMatchObject({
        level: 1,
        version: 2,
        path: `${other.id}/${child.id}`,
      });
      const reloaded = await http()
        .get(`/api/v2/reason-codes/${leaf.id}`)
        .set(bearer(analyst))
        .expect(200);
      expect(json<unknown>(reloaded)).toMatchObject({
        level: 2,
        path: `${other.id}/${child.id}/${leaf.id}`,
      });
      await change(child.id, 2, { parentId: root.id }).expect(200);
    });

    it('answers 409 with reference counts when retiring a parent with children', async () => {
      const response = await post(`reason-codes/${root.id}/retire`, {}).expect(
        409,
      );
      expect(json<unknown>(response)).toMatchObject({
        code: 'CODE_HAS_CHILDREN',
        details: {
          references: { activeChildren: 1, events: 0, mappingRules: 0 },
        },
      });
    });

    it('retires a leaf: it leaves the active list, history stays', async () => {
      const retired = await post(`reason-codes/${leaf.id}/retire`, {}).expect(
        200,
      );
      expect(json<unknown>(retired)).toMatchObject({ active: false });
      const list = await http()
        .get(`/api/v2/reason-codes?parentId=${child.id}`)
        .set(bearer(analyst))
        .expect(200);
      expect(json<CodeList>(list).items).toEqual([]);
      const all = await http()
        .get(`/api/v2/reason-codes?parentId=${child.id}&includeRetired=true`)
        .set(bearer(analyst))
        .expect(200);
      expect(json<CodeList>(all).items).toHaveLength(1);
      const versions = await http()
        .get(`/api/v2/reason-codes/${leaf.id}/versions`)
        .set(bearer(analyst))
        .expect(200);
      const history =
        json<Array<{ version: number; effectiveTo: string | null }>>(versions);
      expect(history.map((row) => row.version)).toEqual([1]);
      expect(history[0].effectiveTo).not.toBeNull();
      await post(`reason-codes/${leaf.id}/retire`, {}).expect(409);
    });

    it('keeps historical code mapping rules unchanged when a new version is added', async () => {
      const v1 = await post('code-mapping-rules', {
        ruleKind: 'reason_to_schedule_class',
        sourceCodeId: child.id,
        targetValue: 'planned',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
      }).expect(201);
      const ruleRow = (id: string) =>
        rows<unknown>(`SELECT * FROM code_mapping_rules WHERE id = $1`, [id]);
      const before = await ruleRow(json<IdBody>(v1).id);
      const v2 = await post('code-mapping-rules', {
        ruleKind: 'reason_to_schedule_class',
        sourceCodeId: child.id,
        targetValue: 'unplanned',
        effectiveFrom: '2026-06-01T00:00:00.000Z',
      }).expect(201);
      expect(json<unknown>(v2)).toMatchObject({ version: 2 });
      await change(child.id, 3, { name: 'Bearing failure' }).expect(200);
      const after = await ruleRow(json<IdBody>(v1).id);
      expect(after).toEqual(before);
      const asOf = (instant: string) =>
        http()
          .get(
            `/api/v2/code-mapping-rules?sourceCodeId=${child.id}&asOf=${instant}`,
          )
          .set(bearer(analyst))
          .expect(200);
      expect(json<CodeList>(await asOf('2026-03-01T00:00:00Z')).items).toEqual([
        expect.objectContaining({ version: 1, targetValue: 'planned' }),
      ]);
      expect(json<CodeList>(await asOf('2026-07-01T00:00:00Z')).items).toEqual([
        expect.objectContaining({ version: 2, targetValue: 'unplanned' }),
      ]);
      const versions = await http()
        .get(`/api/v2/reason-codes/${child.id}/versions`)
        .set(bearer(analyst))
        .expect(200);
      expect(
        json<Array<{ version: number }>>(versions).map((row) => row.version),
      ).toEqual([1, 2, 3, 4]);
    });

    it('applies the rule in force to a coded event and flags a user override', async () => {
      const created = await post('production-events', {
        unitId: world.unitA1,
        eventType: 'ProductionLoss',
        startTime: at('03:00', '2026-03-02').toISOString(),
        endTime: at('04:00', '2026-03-02').toISOString(),
        reasonCodeId: child.id,
      }).expect(201);
      const event = json<EventBody>(created);
      expect(event.classification.scheduleClass).toBe('planned');
      expect(event.classificationBasis?.scheduleClass).toMatchObject({
        source: 'code_rule',
        ruleVersion: 1,
        overridesDefault: false,
      });
      const patched = await http()
        .patch(`/api/v2/production-events/${event.id}`)
        .set(bearer(admin))
        .set('If-Match', created.headers.etag)
        .send({ reasonCodeId: child.id, scheduleClass: 'external' })
        .expect(200);
      const patchedEvent = json<EventBody>(patched);
      expect(patchedEvent.classification.scheduleClass).toBe('external');
      expect(patchedEvent.classificationBasis?.scheduleClass).toMatchObject({
        source: 'user',
        defaultValue: 'planned',
        overridesDefault: true,
      });
      const [coding] = await rows<{ version: number }>(
        `SELECT cv.version FROM event_coding ec JOIN code_versions cv ON cv.id = ec.reason_code_version_id
          WHERE ec.event_id = $1 ORDER BY ec.revision DESC LIMIT 1`,
        [event.id],
      );
      expect(coding).toEqual({ version: 4 });
    });
  });

  describe('per-tenant libraries (NFR01)', () => {
    it('allows the same code in two tenants and 409s a duplicate in one', async () => {
      await create({ code: 'DUP', name: 'Tenant A' });
      const inB = await post(
        'reason-codes',
        { code: 'DUP', name: 'Tenant B' },
        adminB,
      ).expect(201);
      expect(json<CodeBody>(inB).code).toBe('DUP');
      const duplicate = await post('reason-codes', {
        code: 'DUP',
        name: 'again',
      }).expect(409);
      expect(json<ErrorBody>(duplicate).code).toBe('CODE_EXISTS');
    });

    it('isolates tenants: foreign ids are 404, foreign parents 422', async () => {
      const own = await create({ code: 'ISO', name: 'Isolated' });
      await http()
        .get(`/api/v2/reason-codes/${own.id}`)
        .set(bearer(adminB))
        .expect(404);
      await http()
        .put(`/api/v2/reason-codes/${own.id}`)
        .set(bearer(adminB))
        .set('If-Match', '"1"')
        .send({ name: 'x' })
        .expect(404);
      await post(`reason-codes/${own.id}/retire`, {}, adminB).expect(404);
      const child = await post(
        'reason-codes',
        { code: 'ISO.CHILD', name: 'x', parentId: own.id },
        adminB,
      ).expect(422);
      expect(json<ErrorBody>(child).code).toBe('INVALID_REFERENCE');
      const rule = await post(
        'code-mapping-rules',
        {
          ruleKind: 'reason_to_oee',
          sourceCodeId: own.id,
          targetValue: 'quality',
        },
        adminB,
      ).expect(422);
      expect(json<ErrorBody>(rule).code).toBe('INVALID_REFERENCE');
      const listB = await http()
        .get('/api/v2/reason-codes')
        .set(bearer(adminB))
        .expect(200);
      expect(json<CodeList>(listB).items.map((item) => item.code)).toEqual([
        'DUP',
      ]);
    });

    it('rejects a shared (tenant-less) reason code on events', async () => {
      const shared = randomUUID();
      await harness.dataSource.query(
        `INSERT INTO reason_codes (id, code, name) VALUES ($1, 'SHARED', 'Shared')`,
        [shared],
      );
      const response = await post('production-events', {
        unitId: world.unitA1,
        eventType: 'ProductionLoss',
        startTime: at('05:00', '2026-03-03').toISOString(),
        reasonCodeId: shared,
      }).expect(422);
      expect(json<ErrorBody>(response).code).toBe('INVALID_REFERENCE');
    });

    it('needs a master data role to write (403) and keeps library-specific fields apart (422)', async () => {
      await post('reason-codes', { code: 'NOPE', name: 'x' }, analyst).expect(
        403,
      );
      const wrong = await post('oee-codes', {
        code: 'OEE1',
        name: 'x',
        defaultScheduleClass: 'planned',
      }).expect(422);
      expect(json<ErrorBody>(wrong).code).toBe('FIELD_NOT_ALLOWED');
    });
  });
});
