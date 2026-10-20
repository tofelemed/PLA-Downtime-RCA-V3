import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { ProductionEventModule } from '../../src/production-event/production-event.module';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import {
  at,
  EventWorld,
  insertTenantAEvent,
  seedEventWorld,
} from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

/** The JSON body of a supertest response, typed for the fields these tests read. */
interface ResponseBody {
  code: string;
  message: string;
  items: Array<{ id: string }>;
  fieldErrors: Array<{ field: string }>;
  reasonCode: unknown;
}

const bodyOf = (response: { body: unknown }): ResponseBody =>
  response.body as ResponseBody;

interface ListBody {
  items: Array<Record<string, unknown> & { id: string }>;
  nextCursor: string | null;
  asOf: string;
  scope: { tenantId: string };
}

/** v1 `GET /production-events`: always one page (plan 1.6). */
interface V1Page {
  items: Array<Record<string, unknown> & { id: string }>;
}

const ids = (rows: Array<{ id: string }>) => rows.map((row) => row.id).sort();
const v1Items = (response: request.Response) => (response.body as V1Page).items;

/** T13 core (compound queries) for v1 bug fixes B1/B2/B17 and the v2 reference endpoint. */
describe('production events: v1 fixes and the v2 reference endpoint', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, {
      modules: [ProductionEventModule, V2Module],
    });
    tokenA = signToken(app, { userId: randomUUID(), tenantId: world.tenantA });
    tokenB = signToken(app, { userId: randomUUID(), tenantId: world.tenantB });
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  const v1 = (query: Record<string, unknown>) =>
    request(app.getHttpServer())
      .get('/api/production-events')
      .query(query)
      .set(bearer(tokenA));

  const v2 = (query: Record<string, unknown>, token = tokenA) =>
    request(app.getHttpServer())
      .get('/api/v2/production-events')
      .query(query)
      .set(bearer(token));

  describe('v1 GET /production-events', () => {
    it('requires a token (401, not 500)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/production-events')
        .expect(401);
      expect(bodyOf(response).code).toBe('UNAUTHENTICATED');
    });

    it('B1: ANDs tenantId and unitId instead of ignoring unitId', async () => {
      const response = await v1({
        tenantId: world.tenantA,
        unitId: world.unitA1,
      }).expect(200);

      // plan 1.6: always one page (default 50 rows), never the unbounded array
      expect(response.body).toMatchObject({ total: 3, page: 1, pageSize: 50 });
      expect(ids(v1Items(response))).toEqual(
        ids([
          { id: world.events.e1 },
          { id: world.events.e2 },
          { id: world.events.e6 },
        ]),
      );
    });

    it('B2: date range uses overlap semantics on real SQL (no Mongo operators)', async () => {
      const response = await v1({
        tenantId: world.tenantA,
        startDate: at('08:45').toISOString(),
        endDate: at('09:45').toISOString(),
      }).expect(200);

      expect(ids(v1Items(response))).toEqual(
        ids([
          { id: world.events.e1 },
          { id: world.events.e2 },
          { id: world.events.e3 },
        ]),
      );
    });

    it('combines every filter: tenant + unit + reason + type + window + isOpen', async () => {
      const closed = await v1({
        tenantId: world.tenantA,
        unitId: world.unitA2,
        reasonCodeId: world.reasonR1,
        eventType: 'ProductionLoss',
        isOpen: 'false',
      }).expect(200);
      expect(ids(v1Items(closed))).toEqual([world.events.e3]);

      const running = await v1({
        tenantId: world.tenantA,
        isOpen: 'true',
      }).expect(200);
      expect(ids(v1Items(running))).toEqual([world.events.e4]);
    });

    it('B17: reads include the reasonCode and rca relations', async () => {
      const list = await v1({
        tenantId: world.tenantA,
        unitId: world.unitA1,
      }).expect(200);
      const e1 = v1Items(list).find((row) => row.id === world.events.e1);
      expect(e1?.reasonCode).toMatchObject({
        id: world.reasonR1,
        name: 'Mechanical',
      });
      expect(e1).toHaveProperty('rca');
      expect(e1?.asset).toMatchObject({ id: world.assetA1 });

      const one = await request(app.getHttpServer())
        .get(`/api/production-events/${world.events.e1}`)
        .set(bearer(tokenA))
        .expect(200);
      expect(bodyOf(one).reasonCode).toMatchObject({ id: world.reasonR1 });
      expect(one.body).toHaveProperty('rca');
    });

    it('pages with page/pageSize, newest first', async () => {
      const response = await v1({
        tenantId: world.tenantA,
        unitId: world.unitA1,
        page: 1,
        pageSize: 2,
      }).expect(200);

      expect(response.body).toMatchObject({ total: 3, page: 1, pageSize: 2 });
      expect(
        bodyOf(response).items.map((row: { id: string }) => row.id),
      ).toEqual([world.events.e2, world.events.e1]);

      const second = await v1({
        tenantId: world.tenantA,
        unitId: world.unitA1,
        page: 2,
        pageSize: 2,
      }).expect(200);
      expect(bodyOf(second).items.map((row: { id: string }) => row.id)).toEqual(
        [world.events.e6],
      );
    });

    it('rejects malformed filters with 400 VALIDATION_FAILED and message[] (frontend contract)', async () => {
      const response = await v1({ unitId: 'not-a-uuid', pageSize: 201 }).expect(
        400,
      );

      expect(bodyOf(response).code).toBe('VALIDATION_FAILED');
      expect(Array.isArray(bodyOf(response).message)).toBe(true);
      expect(
        bodyOf(response).fieldErrors.map(
          (error: { field: string }) => error.field,
        ),
      ).toEqual(expect.arrayContaining(['unitId', 'pageSize']));
    });
  });

  describe('v2 GET /api/v2/production-events', () => {
    it('takes the tenant from the token and never leaks the other tenant', async () => {
      const asA = await v2({}).expect(200);
      const asB = await v2({}, tokenB).expect(200);

      const bodyA = asA.body as ListBody;
      const bodyB = asB.body as ListBody;
      expect(bodyA.scope).toEqual({ tenantId: world.tenantA });
      expect(ids(bodyA.items)).toEqual(
        ids(
          ['e1', 'e2', 'e3', 'e4', 'e5', 'e6'].map((key) => ({
            id: world.events[key as keyof typeof world.events],
          })),
        ),
      );
      expect(ids(bodyB.items)).toEqual([world.events.eB1]);
      expect(bodyA.nextCursor).toBeNull();
      expect(new Date(bodyA.asOf).toString()).not.toBe('Invalid Date');
    });

    it('T13: ANDs unitIds (OR within) + reasonIds + overlapping window', async () => {
      const response = await v2({
        unitIds: [world.unitA1, world.unitA2],
        reasonIds: world.reasonR1,
        from: at('08:45').toISOString(),
        to: at('09:45').toISOString(),
      }).expect(200);

      expect(ids((response.body as ListBody).items)).toEqual(
        ids([{ id: world.events.e1 }, { id: world.events.e3 }]),
      );
    });

    it('filters by eventTypes, statuses and isOpen', async () => {
      const types = await v2({ eventTypes: ['IOW', 'SOL'] }).expect(200);
      expect(ids(bodyOf(types).items)).toEqual(
        ids([{ id: world.events.e2 }, { id: world.events.e5 }]),
      );

      const open = await v2({ statuses: 'Open', isOpen: 'true' }).expect(200);
      expect(ids(bodyOf(open).items)).toEqual([world.events.e4]);
    });

    it('serialises decimals as strings and times as ISO 8601', async () => {
      const response = await v2({
        unitIds: world.unitA1,
        reasonIds: world.reasonR1,
        to: at('09:30').toISOString(),
        from: at('08:30').toISOString(),
      }).expect(200);
      const e1 = (response.body as ListBody).items.find(
        (row) => row.id === world.events.e1,
      );

      expect(typeof e1?.quantity).toBe('string');
      expect(Number(e1?.quantity)).toBe(12.5);
      expect(e1?.startTime).toBe(at('08:00').toISOString());
      expect(e1?.isOpen).toBe(false);
    });

    it('rejects tenantId as a query parameter with 400', async () => {
      const response = await v2({ tenantId: world.tenantA }).expect(400);
      expect(bodyOf(response).code).toBe('TENANT_FROM_IDENTITY');
    });

    it('validates limit bounds and filters with 422 + fieldErrors', async () => {
      const low = await v2({ limit: 0 }).expect(422);
      expect(bodyOf(low).code).toBe('VALIDATION_FAILED');
      expect(bodyOf(low).fieldErrors[0].field).toBe('limit');

      await v2({ limit: 501 }).expect(422);
      await v2({ unitIds: 'nope' }).expect(422);
      await v2({ sort: 'unitId' }).expect(422);

      const range = await v2({
        from: at('10:00').toISOString(),
        to: at('09:00').toISOString(),
      }).expect(422);
      expect(bodyOf(range).code).toBe('INVALID_RANGE');
    });

    it('rejects a forged cursor with 400 INVALID_CURSOR', async () => {
      const response = await v2({ cursor: 'definitely-not-a-cursor' }).expect(
        400,
      );
      expect(bodyOf(response).code).toBe('INVALID_CURSOR');
    });

    it('paginates with a stable keyset cursor while rows are inserted (no duplicates, no gaps)', async () => {
      const originals = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6'].map(
        (key) => world.events[key as keyof typeof world.events],
      );
      const pages: ListBody[] = [];

      pages.push((await v2({ limit: 2 }).expect(200)).body as ListBody);
      expect(pages[0].items.map((row) => row.id)).toEqual([
        world.events.e4,
        world.events.e2,
      ]);
      expect(pages[0].nextCursor).toEqual(expect.any(String));

      // A newer row sorts before the first page (must not reappear), an older one belongs on the last page.
      const newest = await insertTenantAEvent(
        harness.dataSource,
        world,
        at('13:00'),
        at('13:30'),
      );
      const oldest = await insertTenantAEvent(
        harness.dataSource,
        world,
        at('08:00', '2026-10-05'),
        at('09:00', '2026-10-05'),
      );

      let cursor = pages[0].nextCursor;
      while (cursor) {
        const page = (await v2({ limit: 2, cursor }).expect(200))
          .body as ListBody;
        pages.push(page);
        cursor = page.nextCursor;
      }

      const seen = pages.flatMap((page) => page.items.map((row) => row.id));
      expect(new Set(seen).size).toBe(seen.length);
      expect(seen).toEqual(expect.arrayContaining(originals));
      expect(seen).toContain(oldest);
      expect(seen).not.toContain(newest);
      expect(seen[seen.length - 1]).toBe(oldest);
      expect(pages[pages.length - 1].nextCursor).toBeNull();
      expect(pages.length).toBe(4);
    });

    it('supports ascending sort with the same cursor mechanics', async () => {
      const first = (await v2({ limit: 3, sort: 'startTime' }).expect(200))
        .body as ListBody;
      const second = (
        await v2({
          limit: 3,
          sort: 'startTime',
          cursor: first.nextCursor,
        }).expect(200)
      ).body as ListBody;

      const starts = [...first.items, ...second.items].map((row) =>
        String(row.startTime),
      );
      expect([...starts].sort()).toEqual(starts);
      expect(
        new Set([...first.items, ...second.items].map((row) => row.id)).size,
      ).toBe(6);
    });
  });
});
