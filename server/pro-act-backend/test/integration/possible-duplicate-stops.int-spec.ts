import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { ProductionEventModule } from '../../src/production-event/production-event.module';
import { EventRevisionService } from '../../src/production-event/revisions/event-revision.service';
import { CONNECTOR_ACTOR } from '../../src/production-event/revisions/revision-actor';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';
import { json, V2EventClient } from './support/v2-event-client';

interface ListBody {
  items: Array<{ id: string }>;
}

const DAY = '2026-09-20'; // away from the seed world's 6–7 Oct events
const t = (time: string) => `${DAY}T${time}:00.000Z`;

/**
 * DT-04: one asset cannot stop twice at the same time, so two live stops of the same asset (or two
 * unit-level stops of the same unit) whose intervals overlap are listed as possible duplicates — e.g. a
 * manual entry and the PI event of the same trip. Split children never overlap; superseded and
 * retracted events are not live.
 */
describe('possible duplicate stops (DT-04)', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let api: V2EventClient;
  let token: string;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, {
      modules: [ProductionEventModule, V2Module],
    });
    token = signToken(app, { userId: randomUUID(), tenantId: world.tenantA });
    api = new V2EventClient(app, token);
    const stop = (start: string, end: string, extra = {}) =>
      api.createManual({
        unitId: world.unitA1,
        eventType: 'ProductionLoss',
        startTime: t(start),
        endTime: t(end),
        ...extra,
      });
    ids.manual = await stop('10:00', '11:00', { assetId: world.assetA1 });
    ids.pi = await api.createPi(world.tenantA, {
      unitId: world.unitA1,
      assetId: world.assetA1,
      eventType: 'ProductionLoss',
      description: 'PI trip',
      startTime: t('10:20'),
      endTime: t('10:40'),
    });
    ids.unitLevel = await stop('10:30', '10:50');
    ids.alone = await stop('12:00', '13:00', { assetId: world.assetA1 });
    ids.advisory = await stop('12:30', '12:45', {
      assetId: world.assetA1,
      eventType: 'IOW',
    });
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  async function listed(possibleDuplicate: boolean): Promise<string[]> {
    const response = await request(app.getHttpServer())
      .get('/api/v2/production-events')
      .query({
        unitIds: world.unitA1,
        from: t('00:00'),
        to: `2026-09-21T00:00:00.000Z`,
        possibleDuplicate: String(possibleDuplicate),
        limit: 200,
      })
      .set(bearer(token))
      .expect(200);
    return json<ListBody>(response).items.map((e) => e.id);
  }

  it('lists both overlapping stops of one asset; a unit-level stop, a lone stop and an advisory are not duplicates', async () => {
    expect((await listed(true)).sort()).toEqual([ids.manual, ids.pi].sort());
    expect(await listed(false)).toEqual(
      expect.arrayContaining([ids.unitLevel, ids.alone, ids.advisory]),
    );
    expect(await listed(false)).not.toContain(ids.manual);
  });

  it('retracting one of the pair clears the other', async () => {
    await app
      .get(EventRevisionService)
      .retract(ids.manual, CONNECTOR_ACTOR, 'duplicate of the PI trip');
    expect(await listed(true)).toEqual([]);
  });

  it('rejects a non-boolean value (422 like every v2 query validation)', async () => {
    await request(app.getHttpServer())
      .get('/api/v2/production-events')
      .query({ possibleDuplicate: 'maybe' })
      .set(bearer(token))
      .expect(422);
  });
});
