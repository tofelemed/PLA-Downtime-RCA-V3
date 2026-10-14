import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { ProductionEventModule } from '../../src/production-event/production-event.module';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';
import { json, V2EventClient } from './support/v2-event-client';

interface Selection {
  count: number;
  firstStart: string | null;
  lastEnd: string | null;
  unitIds: string[];
  assetCount: number;
  items: Array<{ id: string; rowVersion: number }>;
}

const DAY = '2026-09-24';
const t = (time: string) => `${DAY}T${time}:00.000Z`;
const window = { from: t('00:00'), to: '2026-09-25T00:00:00.000Z' };

/**
 * SME D13: "all matching" bulk coding is an explicit action on a server snapshot — the matching events with
 * their versions, count, first start / last end, units and assets — which bulk coding then uses as is.
 */
describe('event selection snapshot (SME D13)', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let api: V2EventClient;
  let token: string;
  const ids: string[] = [];

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, {
      modules: [ProductionEventModule, V2Module],
    });
    token = signToken(app, { userId: randomUUID(), tenantId: world.tenantA });
    api = new V2EventClient(app, token);
    for (const [start, end] of [
      ['06:00', '06:20'],
      ['08:00', '08:40'],
      ['10:00', '10:05'],
    ]) {
      ids.push(
        await api.createManual({
          unitId: world.unitA1,
          assetId: world.assetA1,
          eventType: 'ProductionLoss',
          startTime: t(start),
          endTime: t(end),
        }),
      );
    }
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  const select = (query: Record<string, string>) =>
    request(app.getHttpServer())
      .get('/api/v2/production-events/selection')
      .query(query)
      .set(bearer(token));

  it('returns every matching event with its version and a summary of what the action touches', async () => {
    const body = json<Selection>(
      await select({
        ...window,
        unitIds: world.unitA1,
        codingStates: 'uncoded',
      }).expect(200),
    );
    expect(body.items.map((i) => i.id)).toEqual(ids);
    expect(body).toMatchObject({
      count: 3,
      firstStart: t('06:00'),
      lastEnd: t('10:05'),
      unitIds: [world.unitA1],
      assetCount: 1,
    });
    expect(body.items.every((i) => i.rowVersion === 1)).toBe(true);
  });

  it('the snapshot feeds bulk coding unchanged', async () => {
    const body = json<Selection>(
      await select({ ...window, unitIds: world.unitA1 }).expect(200),
    );
    const preview = await api
      .post('/api/v2/production-events/bulk-code', {
        items: body.items.map((i) => ({
          eventId: i.id,
          expectedVersion: i.rowVersion,
        })),
        codes: { reasonCodeId: world.reasonR1 },
        reason: 'shift-end coding',
        preview: true,
      })
      .expect(200);
    expect(json<{ count: number }>(preview).count).toBe(3);
  });

  it('requires the window (422) like the export', async () => {
    await select({ unitIds: world.unitA1 }).expect(422);
    await select({ from: window.to, to: window.from }).expect(422);
  });
});
