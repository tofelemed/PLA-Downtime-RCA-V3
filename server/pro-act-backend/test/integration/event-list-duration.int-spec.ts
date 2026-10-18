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
  items: Array<{ id: string; durationSeconds: number | null }>;
  nextCursor: string | null;
}

const HOUR = 3_600_000;

/** UX E-1 / E-7: duration sort with keyset pages, minDurationSeconds and verificationStates. */
describe('v2 event list: duration sort and filters', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let api: V2EventClient;
  let token: string;
  const now = Date.now();
  const iso = (offsetHours: number) =>
    new Date(now + offsetHours * HOUR).toISOString();
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, {
      modules: [ProductionEventModule, V2Module],
    });
    token = signToken(app, { userId: randomUUID(), tenantId: world.tenantA });
    api = new V2EventClient(app, token);
    const stop = (start: number, end?: number) =>
      api.createManual({
        unitId: world.unitA3,
        startTime: iso(start),
        ...(end === undefined ? {} : { endTime: iso(end) }),
        eventType: 'ProductionLoss',
      });
    ids.oneHour = await stop(-30, -29);
    ids.threeHours = await stop(-28, -25);
    ids.halfHour = await stop(-24, -23.5);
    ids.openTwoHours = await stop(-2);
    await harness.dataSource.query(
      `UPDATE production_events SET verified_by = $2, verified_at = now() WHERE id = $1`,
      [ids.threeHours, randomUUID()],
    );
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  async function list(query: Record<string, unknown>): Promise<ListBody> {
    const response = await request(app.getHttpServer())
      .get('/api/v2/production-events')
      // the window leaves out the seeded events of the unit
      .query({ unitIds: world.unitA3, from: iso(-31), to: iso(1), ...query })
      .set(bearer(token))
      .expect(200);
    return json<ListBody>(response);
  }

  async function allPages(query: Record<string, unknown>): Promise<string[]> {
    const seen: string[] = [];
    let cursor: string | null | undefined;
    do {
      const page = await list({
        ...query,
        limit: 1,
        ...(cursor ? { cursor } : {}),
      });
      seen.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor;
    } while (cursor);
    return seen;
  }

  it('-durationSeconds: running events first, then longest first, page by page without gaps', async () => {
    expect(await allPages({ sort: '-durationSeconds' })).toEqual([
      ids.openTwoHours,
      ids.threeHours,
      ids.oneHour,
      ids.halfHour,
    ]);
  });

  it('durationSeconds: shortest first, running events last', async () => {
    expect(await allPages({ sort: 'durationSeconds' })).toEqual([
      ids.halfHour,
      ids.oneHour,
      ids.threeHours,
      ids.openTwoHours,
    ]);
  });

  it('minDurationSeconds keeps closed events by duration and running events by elapsed time', async () => {
    const atLeast90Min = (await list({ minDurationSeconds: 5400 })).items.map(
      (item) => item.id,
    );
    expect(atLeast90Min.sort()).toEqual(
      [ids.threeHours, ids.openTwoHours].sort(),
    );
    const atLeast4h = (await list({ minDurationSeconds: 14_400 })).items;
    expect(atLeast4h).toEqual([]);
  });

  it('verificationStates filters on the supervisor verification', async () => {
    const verified = (await list({ verificationStates: 'verified' })).items;
    expect(verified.map((item) => item.id)).toEqual([ids.threeHours]);
    const notVerified = (await list({ verificationStates: 'not_verified' }))
      .items;
    expect(notVerified.map((item) => item.id)).not.toContain(ids.threeHours);
    expect(notVerified).toHaveLength(3);
  });

  it('refuses a start-time cursor on the duration sort (400 INVALID_CURSOR)', async () => {
    const first = await list({ sort: '-startTime', limit: 1 });
    await request(app.getHttpServer())
      .get('/api/v2/production-events')
      .query({
        unitIds: world.unitA3,
        from: iso(-31),
        sort: '-durationSeconds',
        cursor: first.nextCursor,
      })
      .set(bearer(token))
      .expect(400);
  });
});
