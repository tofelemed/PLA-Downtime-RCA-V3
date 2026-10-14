import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { ProductionEventModule } from '../../src/production-event/production-event.module';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';
import { json, V2EventClient } from './support/v2-event-client';

interface EventBody {
  id: string;
  originUnitId: string | null;
  originAssetId: string | null;
  rowVersion: number;
}

const t = (time: string) => `2026-09-22T${time}:00.000Z`;

/**
 * SME D3: a stop names the unit / asset whose failure caused it. The extruder (unit A2) starved by a trip
 * of unit A1's asset keeps the stop; the origin is validated against the tenant and kept in the revisions.
 */
describe('stop origin (SME D3)', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let api: V2EventClient;
  let token: string;

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, {
      modules: [ProductionEventModule, V2Module],
    });
    token = signToken(app, { userId: randomUUID(), tenantId: world.tenantA });
    api = new V2EventClient(app, token);
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  const create = (body: Record<string, unknown>) =>
    api.post('/api/v2/production-events', {
      unitId: world.unitA2,
      eventType: 'ProductionLoss',
      scheduleClass: 'external',
      startTime: t('08:00'),
      endTime: t('10:00'),
      ...body,
    });

  it('stores the origin unit and asset and shows them on the event', async () => {
    const created = json<EventBody>(
      await create({
        originUnitId: world.unitA1,
        originAssetId: world.assetA1,
      }).expect(201),
    );
    expect(created).toMatchObject({
      originUnitId: world.unitA1,
      originAssetId: world.assetA1,
    });
  });

  it('refuses an asset that is not of the origin unit, and a unit of another tenant (422)', async () => {
    const wrongAsset = await create({
      originUnitId: world.unitA3,
      originAssetId: world.assetA1,
    }).expect(422);
    expect(json<{ code: string }>(wrongAsset).code).toBe('INVALID_REFERENCE');
    await create({ originUnitId: world.unitB1 }).expect(422);
  });

  it('a later edit of the origin is a revision of the event', async () => {
    const created = json<EventBody>(await create({}).expect(201));
    await request(app.getHttpServer())
      .patch(`/api/v2/production-events/${created.id}`)
      .set(bearer(token))
      .set('If-Match', `"${created.rowVersion}"`)
      .send({ originUnitId: world.unitA1 })
      .expect(200);
    const history = await request(app.getHttpServer())
      .get(`/api/v2/production-events/${created.id}/revisions`)
      .set(bearer(token))
      .expect(200);
    expect(JSON.stringify(history.body)).toContain('originUnitId');
  });
});
