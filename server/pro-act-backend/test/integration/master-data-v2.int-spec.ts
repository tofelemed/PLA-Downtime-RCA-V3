import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

interface Row {
  id: string;
  code: string;
  name: string;
  rowVersion: number;
  retiredAt?: string | null;
  isActive?: boolean;
  availability?: string;
  activeChildren?: number;
  nodeCount?: number;
  checklistIds?: string[];
  logicTree?: Array<{ id: string; children?: unknown[] }>;
  items?: string[];
  color?: string | null;
  description?: string | null;
  unitId?: string;
}

interface Page {
  items: Row[];
  nextCursor: string | null;
}

interface ErrorBody {
  code: string;
  fieldErrors?: Array<{ field: string }>;
}

/**
 * Master data on v2: units, assets, products, RCA templates / causes / checklists and the overview counts.
 * Writers (`master_data_admin`, `manager_approver`; TenantAdmin via D06) create, change under If-Match,
 * retire and restore; codes are unique (case-insensitive) with a field error; tenant B never sees or
 * changes tenant A's rows; products are organisation-wide unless created for one plant.
 */
describe('v2 master data', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let admin = '';
  let adminB = '';
  let analyst = '';

  const http = () => request(app.getHttpServer());
  const body = <T>(response: request.Response): T => response.body as T;
  const post = (path: string, payload: object, token = admin) =>
    http()
      .post(`/api/v2/${path}`)
      .set(bearer(token))
      .set('Idempotency-Key', randomUUID())
      .send(payload);
  const patch = (
    path: string,
    version: number,
    payload: object,
    token = admin,
  ) =>
    http()
      .patch(`/api/v2/${path}`)
      .set(bearer(token))
      .set('If-Match', `"${version}"`)
      .send(payload);
  const get = (path: string, token = admin) =>
    http().get(`/api/v2/${path}`).set(bearer(token));

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, { modules: [V2Module] });
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
    analyst = signToken(app, {
      userId: randomUUID(),
      tenantId: world.tenantA,
      role: 'Analyst',
    });
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  describe('units', () => {
    let created: Row;

    it('creates a unit; a duplicate code (any case) is 409 on the code field; readers are 403', async () => {
      const response = await post('units', {
        code: 'EXT-LINE-9',
        name: 'Extruder 9',
        unitOfMeasure: 't',
        capacity: '12.5',
      }).expect(201);
      created = body<Row>(response);
      expect(response.headers.etag).toBe('"1"');
      expect(created).toMatchObject({
        code: 'EXT-LINE-9',
        retiredAt: null,
        rowVersion: 1,
      });
      const duplicate = body<ErrorBody>(
        await post('units', { code: 'ext-line-9', name: 'Copy' }).expect(409),
      );
      expect(duplicate.code).toBe('MASTER_DATA_CODE_EXISTS');
      expect(duplicate.fieldErrors?.[0].field).toBe('code');
      await post('units', { code: 'NOPE', name: 'Refused' }, analyst).expect(
        403,
      );
    });

    it('searches, filters and pages by code; tenant B sees none of it', async () => {
      const found = body<Page>(await get('units?q=extruder%209').expect(200));
      expect(found.items.map((unit) => unit.code)).toEqual(['EXT-LINE-9']);
      const first = body<Page>(
        await get('units?sort=code&limit=2').expect(200),
      );
      expect(first.items).toHaveLength(2);
      const second = body<Page>(
        await get(
          `units?sort=code&limit=2&cursor=${encodeURIComponent(first.nextCursor ?? '')}`,
        ).expect(200),
      );
      const codes = [...first.items, ...second.items].map((unit) => unit.code);
      expect([...codes].sort()).toEqual(codes);
      expect(new Set(codes).size).toBe(codes.length);
      const other = body<Page>(
        await get('units?q=EXT-LINE-9', adminB).expect(200),
      );
      expect(other.items).toEqual([]);
      await get(`units/${created.id}`, adminB).expect(404);
      await get(`units?tenantId=${world.tenantB}`).expect(400);
      await http().get('/api/v2/units').expect(401);
    });

    it('changes under If-Match: 428 without, 412 when stale, 200 with the version', async () => {
      await http()
        .patch(`/api/v2/units/${created.id}`)
        .set(bearer(admin))
        .send({ name: 'x' })
        .expect(428);
      const changed = body<Row>(
        await patch(`units/${created.id}`, 1, {
          description: 'second line',
          capacity: null,
        }).expect(200),
      );
      expect(changed).toMatchObject({
        description: 'second line',
        rowVersion: 2,
      });
      expect(
        body<ErrorBody>(
          await patch(`units/${created.id}`, 1, { name: 'late' }).expect(412),
        ).code,
      ).toBe('STALE_REVISION');
      await patch(`units/${created.id}`, 2, { code: `unit200-x` }).expect(200);
    });

    it('refuses to retire a unit with active assets; retires and restores otherwise', async () => {
      const refused = body<ErrorBody>(
        await post(`units/${world.unitA1}/retire`, {}).expect(409),
      );
      expect(refused.code).toBe('UNIT_HAS_ACTIVE_ASSETS');
      const retired = body<Row>(
        await post(`units/${created.id}/retire`, {}).expect(200),
      );
      expect(retired.retiredAt).not.toBeNull();
      const active = body<Page>(
        await get('units?status=active&limit=500').expect(200),
      );
      expect(active.items.some((unit) => unit.id === created.id)).toBe(false);
      expect(
        body<ErrorBody>(
          await patch(`units/${created.id}`, retired.rowVersion, {
            name: 'y',
          }).expect(409),
        ).code,
      ).toBe('MASTER_DATA_RETIRED');
      const restored = body<Row>(
        await post(`units/${created.id}/restore`, {}).expect(200),
      );
      expect(restored.retiredAt).toBeNull();
    });
  });

  describe('assets', () => {
    it('creates under an active unit of the plant only; lists by unit; codes unique per plant', async () => {
      const asset = body<Row>(
        await post('assets', {
          code: 'PUMP-7',
          name: 'Pump 7',
          unitId: world.unitA2,
          criticality: 'High',
        }).expect(201),
      );
      expect(asset.unitId).toBe(world.unitA2);
      const foreign = body<ErrorBody>(
        await post('assets', {
          code: 'PUMP-8',
          name: 'Pump 8',
          unitId: world.unitB1,
        }).expect(422),
      );
      expect(foreign.code).toBe('INVALID_REFERENCE');
      await post('assets', {
        code: 'pump-7',
        name: 'Copy',
        unitId: world.unitA3,
      }).expect(409);
      await post('assets', {
        code: 'PUMP-9',
        name: 'Pump 9',
        unitId: world.unitA2,
        criticality: 'Severe',
      }).expect(422);
      const byUnit = body<Page>(
        await get(`assets?unitIds=${world.unitA2}`).expect(200),
      );
      expect(byUnit.items.map((row) => row.code)).toEqual(['PUMP-7']);
      const moved = body<Row>(
        await patch(`assets/${asset.id}`, asset.rowVersion, {
          unitId: world.unitA3,
          status: 'Maintenance',
        }).expect(200),
      );
      expect(moved.unitId).toBe(world.unitA3);
      await post(`assets/${asset.id}/retire`, {}).expect(200);
      await get(`assets/${asset.id}`, adminB).expect(404);
    });
  });

  describe('products', () => {
    it('creates organisation products visible to every plant of the organisation; plant products stay in the plant', async () => {
      const shared = body<Row>(
        await post('products', {
          code: 'HDPE-100',
          name: 'HDPE 100',
          uom: 't',
        }).expect(201),
      );
      expect(shared.availability).toBe('organization');
      const local = body<Row>(
        await post('products', {
          code: 'HDPE-200',
          name: 'HDPE 200',
          availability: 'plant',
        }).expect(201),
      );
      expect(local.availability).toBe('plant');
      const pickerA = body<Page>(await get('products?limit=500').expect(200));
      expect(pickerA.items.map((row) => row.code)).toEqual(['HDPE-200']);
      const adminList = body<Page>(
        await get('products?includeOrganization=true&sort=code').expect(200),
      );
      expect(adminList.items.map((row) => row.code)).toEqual([
        'HDPE-100',
        'HDPE-200',
      ]);
      const seenByB = body<Page>(
        await get('products?includeOrganization=true', adminB).expect(200),
      );
      expect(seenByB.items.map((row) => row.code)).toEqual(['HDPE-100']);
      await get(`products/${local.id}`, adminB).expect(404);
      expect(
        body<ErrorBody>(
          await post(
            'products',
            { code: 'hdpe-100', name: 'Dup' },
            adminB,
          ).expect(409),
        ).code,
      ).toBe('MASTER_DATA_CODE_EXISTS');
      const changed = body<Row>(
        await patch(`products/${shared.id}`, shared.rowVersion, {
          description: 'film grade',
        }).expect(200),
      );
      expect(changed.description).toBe('film grade');
      expect(
        body<Row>(await post(`products/${shared.id}/retire`, {}).expect(200))
          .isActive,
      ).toBe(false);
    });
  });

  describe('RCA settings', () => {
    let checklist: Row;

    it('keeps verification checklists with colour and ordered items', async () => {
      checklist = body<Row>(
        await post('verification-checklists', {
          code: 'VC-1',
          name: 'Bearing check',
          color: '#3B82F6',
          items: ['Noise', 'Heat'],
        }).expect(201),
      );
      expect(checklist.items).toEqual(['Noise', 'Heat']);
      const changed = body<Row>(
        await patch(`verification-checklists/${checklist.id}`, 1, {
          items: ['Heat', 'Noise', 'Oil'],
        }).expect(200),
      );
      expect(changed.items).toEqual(['Heat', 'Noise', 'Oil']);
      await post('verification-checklists', {
        code: 'VC-2',
        name: 'Bad',
        color: 'blue',
      }).expect(422);
    });

    it('stores a template logic tree and its checklists; the list carries a node count only', async () => {
      const tree = [
        {
          id: 'n1',
          name: 'Seal',
          code: 'S1',
          category: 'Equipment',
          children: [
            { id: 'n2', name: 'Wear', code: 'S2', category: 'Material' },
          ],
        },
      ];
      const template = body<Row>(
        await post('rca-templates', {
          name: 'Pump failure',
          category: 'Equipment',
          logicTree: tree,
          checklistIds: [checklist.id],
        }).expect(201),
      );
      expect(template.nodeCount).toBe(2);
      expect(template.logicTree?.[0].children).toHaveLength(1);
      const listed = body<Page>(await get('rca-templates').expect(200));
      expect(listed.items[0].logicTree).toBeUndefined();
      const foreign = body<ErrorBody>(
        await post('rca-templates', {
          name: 'x',
          category: 'y',
          checklistIds: [randomUUID()],
        }).expect(422),
      );
      expect(foreign.fieldErrors?.[0].field).toBe('checklistIds');
      const duplicateIds = [
        { id: 'a', name: 'A', code: 'A', category: 'Method' },
        { id: 'a', name: 'B', code: 'B', category: 'Method' },
      ];
      await patch(`rca-templates/${template.id}`, template.rowVersion, {
        logicTree: duplicateIds,
      }).expect(422);
      const changed = body<Row>(
        await patch(`rca-templates/${template.id}`, template.rowVersion, {
          logicTree: [],
        }).expect(200),
      );
      expect(changed.nodeCount).toBe(0);
      expect(changed.checklistIds).toEqual([checklist.id]);
    });

    it('keeps the cause library a tree: children counts, no cycles, no retire with active sub-causes', async () => {
      const root = body<Row>(
        await post('rca-causes', {
          code: 'C-ROOT',
          name: 'Mechanical',
          category: 'Equipment',
        }).expect(201),
      );
      const child = body<Row>(
        await post('rca-causes', {
          code: 'C-CHILD',
          name: 'Bearing',
          category: 'Equipment',
          parentId: root.id,
        }).expect(201),
      );
      const roots = body<Page>(
        await get('rca-causes?rootsOnly=true').expect(200),
      );
      expect(
        roots.items.find((row) => row.id === root.id)?.activeChildren,
      ).toBe(1);
      const children = body<Page>(
        await get(`rca-causes?parentId=${root.id}`).expect(200),
      );
      expect(children.items.map((row) => row.id)).toEqual([child.id]);
      expect(
        body<ErrorBody>(
          await patch(`rca-causes/${root.id}`, root.rowVersion, {
            parentId: child.id,
          }).expect(422),
        ).code,
      ).toBe('CODE_CYCLE');
      expect(
        body<ErrorBody>(
          await post(`rca-causes/${root.id}/retire`, {}).expect(409),
        ).code,
      ).toBe('RCA_CAUSE_HAS_CHILDREN');
      await post('rca-causes', {
        code: 'c-root',
        name: 'Dup',
        category: 'Method',
      }).expect(409);
      await get(`rca-causes/${root.id}`, adminB).expect(404);
    });
  });

  it('counts the active records of the plant for the overview', async () => {
    const summary = body<Record<string, number>>(
      await get('master-data/summary').expect(200),
    );
    expect(summary).toMatchObject({
      units: 4,
      assets: 1,
      products: 1,
      rcaTemplates: 1,
      rcaCauses: 2,
      verificationChecklists: 1,
    });
    const other = body<Record<string, number>>(
      await get('master-data/summary', adminB).expect(200),
    );
    expect(other).toMatchObject({ units: 1, rcaTemplates: 0, products: 0 });
  });
});
