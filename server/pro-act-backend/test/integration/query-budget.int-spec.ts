import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { ProductionEventModule } from '../../src/production-event/production-event.module';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

/** Statements per list request, whatever the page size (identity + scope + list + relations). */
const QUERY_BUDGET = 12;
const EXTRA_EVENTS = 30;

/**
 * Plan 3.11 step 4 (N+1 guard, ENGINEERING_STANDARDS "No N+1"): a list request runs a fixed number of
 * statements — the same count with 6 rows as with 36 — and stays inside the budget. A relation loaded
 * lazily per row would add one statement per row and fail here.
 */
describe('list endpoints have a fixed query budget (plan 3.11)', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let token = '';
  const statements: string[] = [];

  const countFor = async (path: string): Promise<number> => {
    statements.length = 0;
    await request(app.getHttpServer()).get(path).set(bearer(token)).expect(200);
    return statements.filter(
      (sql) => !/^(START TRANSACTION|COMMIT|ROLLBACK)/i.test(sql),
    ).length;
  };

  const paths = (): string[] => [
    '/api/v2/production-events?limit=100',
    `/api/production-events?tenantId=${world.tenantA}`,
    '/api/v2/units',
  ];

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, {
      modules: [ProductionEventModule, V2Module],
      onQuery: (sql) => statements.push(sql),
    });
    token = signToken(app, {
      userId: randomUUID(),
      tenantId: world.tenantA,
      role: 'TenantAdmin',
    });
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  it('does not grow with the number of rows returned', async () => {
    const before = new Map<string, number>();
    for (const path of paths()) before.set(path, await countFor(path));

    for (let index = 0; index < EXTRA_EVENTS; index++) {
      await request(app.getHttpServer())
        .post('/api/v2/production-events')
        .set(bearer(token))
        .set('Idempotency-Key', randomUUID())
        .send({
          unitId: [world.unitA1, world.unitA2, world.unitA3][index % 3],
          eventType: 'ProductionLoss',
          startTime: new Date(Date.UTC(2026, 9, 1, index)).toISOString(),
          endTime: new Date(Date.UTC(2026, 9, 1, index, 30)).toISOString(),
          reasonCodeId: world.reasonR1,
        })
        .expect(201);
    }

    for (const path of paths()) {
      const after = await countFor(path);
      expect({ path, statements: after }).toEqual({
        path,
        statements: before.get(path),
      });
      expect(after).toBeLessThanOrEqual(QUERY_BUDGET);
    }
  });
});
