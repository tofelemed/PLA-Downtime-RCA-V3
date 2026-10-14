import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { ProductionEventModule } from '../../src/production-event/production-event.module';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';
import { json, V2EventClient } from './support/v2-event-client';

interface ListBody {
  items: Array<{ id: string }>;
}

const DAY = '2026-09-21'; // away from the seed world's events
const t = (time: string) => `${DAY}T${time}:00.000Z`;

/**
 * SME D5: a stop that starts within the window after a stop of the same asset and reason ended is a
 * possible repeat (one unresolved incident) — flagged for review, never merged. The SME example: stopped
 * 10:00–10:03, ran 10:03–10:05, stopped again 10:05–10:09.
 */
describe('possible repeat stops (SME D5)', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let token: string;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, {
      modules: [ProductionEventModule, V2Module],
    });
    token = signToken(app, { userId: randomUUID(), tenantId: world.tenantA });
    const api = new V2EventClient(app, token);
    const stop = (start: string, end: string, reasonCodeId: string) =>
      api.createManual({
        unitId: world.unitA1,
        assetId: world.assetA1,
        eventType: 'ProductionLoss',
        startTime: t(start),
        endTime: t(end),
        reasonCodeId,
      });
    ids.first = await stop('10:00', '10:03', world.reasonR1);
    ids.repeat = await stop('10:05', '10:09', world.reasonR1);
    ids.later = await stop('10:20', '10:25', world.reasonR1);
    ids.otherReason = await stop('10:26', '10:27', world.reasonR2);
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  async function listed(query: Record<string, string>): Promise<string[]> {
    const response = await request(app.getHttpServer())
      .get('/api/v2/production-events')
      .query({
        unitIds: world.unitA1,
        from: t('00:00'),
        to: '2026-09-22T00:00:00.000Z',
        limit: '200',
        ...query,
      })
      .set(bearer(token))
      .expect(200);
    return json<ListBody>(response).items.map((e) => e.id);
  }

  it('flags the restart within the 120 s pilot window only; another reason or a later stop is not a repeat', async () => {
    expect(await listed({ possibleRepeat: 'true' })).toEqual([ids.repeat]);
    expect(await listed({ possibleRepeat: 'false' })).toEqual(
      expect.arrayContaining([ids.first, ids.later, ids.otherReason]),
    );
  });

  it('a wider window (plant calibration) also flags the stop 11 minutes later', async () => {
    expect(
      (
        await listed({ possibleRepeat: 'true', repeatWindowSeconds: '900' })
      ).sort(),
    ).toEqual([ids.repeat, ids.later].sort());
  });

  it('refuses a window outside 1..3600 s (422)', async () => {
    await request(app.getHttpServer())
      .get('/api/v2/production-events')
      .query({ possibleRepeat: 'true', repeatWindowSeconds: '0' })
      .set(bearer(token))
      .expect(422);
  });
});
