import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { ProductionEventModule } from '../../src/production-event/production-event.module';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import { at, EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';
import {
  ErrorBody,
  json,
  OperationBody,
  V2EventClient,
} from './support/v2-event-client';

const DAY = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
const t = (time: string) => at(time, DAY).toISOString();

/** `POST /v2/production-events/{id}/retract`: tombstone of manual events (v2 equivalent of the v1 delete). */
describe('event operations: retract', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let api: V2EventClient;
  let token = '';

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

  const manual = (start: string, end: string) =>
    api.createManual({
      unitId: world.unitA3,
      startTime: t(start),
      endTime: t(end),
      eventType: 'ProductionLoss',
      reasonCodeId: world.reasonR1,
    });
  const retract = (id: string, ifMatch: string, reason = 'entered twice') =>
    api.post(
      `/api/v2/production-events/${id}/retract`,
      { reason },
      { ifMatch },
    );

  it('DB-03: the v1 DELETE retracts instead of deleting; history stays, v1 lists hide it', async () => {
    const id = await manual('09:00', '09:30');
    await request(app.getHttpServer())
      .delete(`/api/production-events/${id}`)
      .set(bearer(token))
      .expect(200);
    const [row] = await harness.dataSource.query<
      Array<{ physical_state: string }>
    >(`SELECT physical_state FROM production_events WHERE id = $1`, [id]);
    expect(row.physical_state).toBe('retracted');
    const revisions = await harness.dataSource.query<Array<{ n: number }>>(
      `SELECT count(*)::int AS n FROM event_revisions WHERE event_id = $1`,
      [id],
    );
    expect(revisions[0].n).toBeGreaterThanOrEqual(2);
    const list = await request(app.getHttpServer())
      .get(`/api/production-events?unitId=${world.unitA3}`)
      .set(bearer(token))
      .expect(200);
    const items = (
      Array.isArray(list.body)
        ? list.body
        : (list.body as { items: unknown[] }).items
    ) as Array<{ id: string }>;
    expect(items.map((item) => item.id)).not.toContain(id);
  });

  it('tombstones a manual event with a retraction revision', async () => {
    const id = await manual('08:00', '08:30');
    const response = await retract(id, await api.etag(id)).expect(200);
    const body = json<
      OperationBody & { operation: string; updatedEventIds: string[] }
    >(response);
    expect(body).toMatchObject({
      operation: 'retract',
      createdEventIds: [],
      supersededEventIds: [],
      updatedEventIds: [id],
    });
    expect(body.events[0]).toMatchObject({
      id,
      states: { physical: 'retracted' },
    });
    const history = await api.history(id);
    expect(history.revisions.at(-1)).toMatchObject({
      kind: 'retraction',
      changeReason: 'entered twice',
    });
  });

  it('412 with a stale If-Match; 409 INVALID_STATE when already retracted', async () => {
    const id = await manual('09:00', '09:30');
    const read = await api.etag(id);
    const stale = await retract(id, `"${Number(read.replace(/"/g, '')) + 5}"`);
    expect(stale.status).toBe(412);
    expect(json<ErrorBody>(stale).code).toBe('STALE_REVISION');
    await retract(id, read).expect(200);
    const again = await retract(id, await api.etag(id)).expect(409);
    expect(json<ErrorBody>(again).code).toBe('INVALID_STATE');
  });

  it('409 SOURCE_OWNED for an event delivered by a source', async () => {
    const id = await api.createPi(world.tenantA, {
      unitId: world.unitA1,
      startTime: t('05:00'),
      endTime: t('05:30'),
      eventType: 'ProductionLoss',
      description: 'Trip',
    });
    const response = await retract(id, await api.etag(id)).expect(409);
    expect(json<ErrorBody>(response).code).toBe('SOURCE_OWNED');
    expect((await api.event(id)).states).toMatchObject({ physical: 'closed' });
  });

  it('422 without a reason', async () => {
    const id = await manual('10:00', '10:30');
    await retract(id, await api.etag(id), '   ').expect(422);
  });
});
