import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { Asset } from '../../src/asset/asset.entity';
import { ProductionEventModule } from '../../src/production-event/production-event.module';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

interface Entry {
  id: string;
  kind: string;
  equipmentClass: string;
  code: string;
  name: string;
  isPending: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  rowVersion: number;
}

interface Page {
  items: Entry[];
  nextCursor: string | null;
}

interface ErrorBody {
  code: string;
  fieldErrors?: Array<{ field: string }>;
  details?: { errors?: Array<{ line: number }> };
}

const CSV = [
  'kind,equipmentClass,code,name,assetTypes,isPending,category',
  'equipment_class,,PU,Pumps,Pump,,',
  'equipment_class,,EM,Electric motors,Motor,,',
  'maintainable_item,PU,SEAL,Mechanical seal,,,',
  'maintainable_item,EM,BRG,Bearing,,,',
  'maintainable_item,,UNK,Unknown,,yes,',
  'failure_mode,PU,ELP,External leakage - process medium,,,',
  'failure_mechanism,,1.1,Leakage,,,Mechanical failure',
  'failure_cause,,4.1,Off-design service,,,Operation / maintenance',
  'failure_cause,,0,Unknown – investigation pending,,yes,',
].join('\n');

/**
 * SME D11: the plant's ISO 14224-aligned failure dictionary on v2 — CSV / JSON import (all or nothing,
 * versions on change), effective-dated CRUD, tenant isolation, and event failure fields checked against
 * the dictionary once a kind has entries (free text before).
 */
describe('failure dictionary (SME D11)', () => {
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
  const list = async (query: string, token = admin) =>
    body<Page>(
      await http()
        .get(`/api/v2/failure-dictionary?${query}`)
        .set(bearer(token))
        .expect(200),
    );
  const stop = (start: string, failure: Record<string, unknown>) =>
    post('production-events', {
      unitId: world.unitA1,
      assetId: world.assetA1,
      eventType: 'ProductionLoss',
      scheduleClass: 'unplanned',
      startTime: `2026-09-23T${start}:00.000Z`,
      endTime: `2026-09-23T${start.slice(0, 2)}:30:00.000Z`,
      ...failure,
    });

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    await harness.dataSource
      .getRepository(Asset)
      .update(world.assetA1, { assetType: 'Pump' });
    app = await createIntegrationApp(harness, {
      modules: [ProductionEventModule, V2Module],
    });
    const sign = (tenantId: string, role: string) =>
      signToken(app, { userId: randomUUID(), tenantId, role });
    admin = sign(world.tenantA, 'TenantAdmin');
    adminB = sign(world.tenantB, 'TenantAdmin');
    analyst = sign(world.tenantA, 'Analyst');
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  it('before any dictionary the failure fields are free text', async () => {
    await stop('01:00', { failureCause: 'lubrication' }).expect(201);
  });

  it('imports a CSV (dry run first), then counts unchanged and changed rows', async () => {
    const effectiveFrom = '2026-01-01T00:00:00.000Z';
    const dry = await post('failure-dictionary/import', {
      csv: CSV,
      effectiveFrom,
      dryRun: true,
    }).expect(200);
    expect(body(dry)).toMatchObject({ total: 9, created: 9, dryRun: true });
    expect((await list('limit=100')).items).toEqual([]);
    await post('failure-dictionary/import', { csv: CSV, effectiveFrom }).expect(
      200,
    );
    const again = await post('failure-dictionary/import', {
      entries: [
        {
          kind: 'equipment_class',
          code: 'PU',
          name: 'Pumps',
          assetTypes: ['Pump'],
        },
        {
          kind: 'failure_mode',
          equipmentClass: 'PU',
          code: 'ELP',
          name: 'External leakage',
        },
      ],
      effectiveFrom: '2026-06-01T00:00:00.000Z',
    }).expect(200);
    expect(body(again)).toMatchObject({
      total: 2,
      created: 0,
      superseded: 1,
      unchanged: 1,
    });
    const modes = await list('kinds=failure_mode&history=true');
    const versions = [...modes.items].sort((a, b) =>
      a.effectiveFrom.localeCompare(b.effectiveFrom),
    );
    expect(versions.map((m) => [m.name, m.effectiveTo])).toEqual([
      ['External leakage - process medium', '2026-06-01T00:00:00.000Z'],
      ['External leakage', null],
    ]);
  });

  it('refuses an import with a bad row and stores nothing', async () => {
    const response = await post('failure-dictionary/import', {
      entries: [
        {
          kind: 'failure_mode',
          equipmentClass: 'PU',
          code: 'FTS',
          name: 'Fail to start on demand',
        },
        { kind: 'failure_mode', equipmentClass: 'XX', code: 'A', name: 'a' },
      ],
    }).expect(422);
    expect(body<ErrorBody>(response)).toMatchObject({
      code: 'DICTIONARY_IMPORT_INVALID',
      details: { errors: [{ line: 2 }] },
    });
    expect((await list('q=FTS')).items).toEqual([]);
  });

  it('lists by class (with the entries valid for every class) and at an instant', async () => {
    const items = await list('kinds=maintainable_item&equipmentClass=PU');
    expect(items.items.map((i) => i.code)).toEqual(['SEAL', 'UNK']);
    const before = await list('kinds=failure_mode&at=2026-03-01T00:00:00.000Z');
    expect(before.items.map((i) => i.name)).toEqual([
      'External leakage - process medium',
    ]);
    expect((await list('limit=100', adminB)).items).toEqual([]);
  });

  it('event failure fields must be codes of the asset class once the dictionary has entries', async () => {
    await stop('02:00', {
      maintainableItem: 'SEAL',
      failureMode: 'ELP',
      failureMechanism: '1.1',
      failureCause: '0',
      detectionMethod: 'Inspection',
    }).expect(201);
    const refused = await stop('03:00', {
      maintainableItem: 'BRG',
      failureCause: 'lubrication',
    }).expect(422);
    expect(body<ErrorBody>(refused)).toMatchObject({
      code: 'FAILURE_CODE_UNKNOWN',
    });
    expect(body<ErrorBody>(refused).fieldErrors?.map((f) => f.field)).toEqual([
      'maintainableItem',
      'failureCause',
    ]);
  });

  it('creates, versions and retires entries; writers only', async () => {
    await post(
      'failure-dictionary',
      { kind: 'detection_method', code: 'INSP', name: 'Inspection' },
      analyst,
    ).expect(403);
    const created = body<Entry>(
      await post('failure-dictionary', {
        kind: 'detection_method',
        code: 'INSP',
        name: 'Inspection',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
      }).expect(201),
    );
    await post('failure-dictionary', {
      kind: 'detection_method',
      code: 'INSP',
      name: 'x',
    }).expect(409);
    await post('failure-dictionary', {
      kind: 'failure_mode',
      equipmentClass: 'XX',
      code: 'Y',
      name: 'y',
    }).expect(422);
    const changed = await http()
      .patch(`/api/v2/failure-dictionary/${created.id}`)
      .set(bearer(admin))
      .set('If-Match', `"${created.rowVersion}"`)
      .send({
        name: 'Periodic inspection',
        effectiveFrom: '2026-07-01T00:00:00.000Z',
      })
      .expect(200);
    expect(body<Entry>(changed)).toMatchObject({
      name: 'Periodic inspection',
      effectiveTo: null,
    });
    await post(`failure-dictionary/${created.id}/retire`, {}).expect(409);
    const pump = (await list('kinds=equipment_class&q=PU')).items[0];
    const inUse = await post(`failure-dictionary/${pump.id}/retire`, {}).expect(
      409,
    );
    expect(body<ErrorBody>(inUse).code).toBe('DICTIONARY_CLASS_IN_USE');
    await http()
      .get(`/api/v2/failure-dictionary/${pump.id}`)
      .set(bearer(adminB))
      .expect(404);
  });
});
