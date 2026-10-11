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
  items: Array<{ id: string; isOpen: boolean }>;
}

const HOUR = 3_600_000;

/** A superseded or retracted event without an end is not a running stop (DT11, isOpen). */
describe('isOpen excludes superseded and retracted events', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let api: V2EventClient;
  let token: string;
  let revisions: EventRevisionService;
  const now = Date.now();
  const iso = (offsetHours: number) =>
    new Date(now + offsetHours * HOUR).toISOString();

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, {
      modules: [ProductionEventModule, V2Module],
    });
    token = signToken(app, { userId: randomUUID(), tenantId: world.tenantA });
    api = new V2EventClient(app, token);
    revisions = app.get(EventRevisionService);
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  const openStop = (startOffsetHours: number) =>
    api.createManual({
      unitId: world.unitA3,
      startTime: iso(startOffsetHours),
      eventType: 'ProductionLoss',
    });

  async function list(isOpen: boolean): Promise<ListBody['items']> {
    const response = await request(app.getHttpServer())
      .get('/api/v2/production-events')
      .query({ unitIds: world.unitA3, isOpen: String(isOpen), limit: 200 })
      .set(bearer(token))
      .expect(200);
    return json<ListBody>(response).items;
  }

  it('split an open stop → the original leaves isOpen=true; the open child stays', async () => {
    const parentId = await openStop(-3);
    const split = await api
      .split(
        parentId,
        { splitAt: iso(-2), reason: 'cause changed' },
        await api.etag(parentId),
      )
      .expect(201);
    const [, openChild] = json<{ createdEventIds: string[] }>(
      split,
    ).createdEventIds;

    const parent = await api.event(parentId);
    expect(parent).toMatchObject({
      endTime: null,
      isOpen: false,
      states: { physical: 'superseded' },
    });
    const openIds = (await list(true)).map((event) => event.id);
    expect(openIds).not.toContain(parentId);
    expect(openIds).toContain(openChild);
    const closed = await list(false);
    expect(closed.find((event) => event.id === parentId)?.isOpen).toBe(false);
  });

  it('a retracted open event is not open either', async () => {
    const id = await openStop(-1);
    await revisions.retract(id, CONNECTOR_ACTOR, 'source deleted');
    expect((await list(true)).map((event) => event.id)).not.toContain(id);
    expect((await api.event(id)).isOpen).toBe(false);
  });
});
