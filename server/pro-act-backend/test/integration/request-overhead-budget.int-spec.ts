import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Server } from 'http';
import { Client } from 'pg';
import * as request from 'supertest';
import { ProductionEventModule } from '../../src/production-event/production-event.module';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

type Query = (this: Client, ...args: unknown[]) => unknown;

/**
 * Per-request overhead budgets (perf audit regression guard, docs/perf-audit): the database statements one
 * request may run, counted at the pg client (RLS binding included). The budgets are the measured counts
 * after the P01 / P02 / P04 / P08 fixes; exceeding one means per-request overhead came back (identity read
 * in several statements, a second auth guard, re-binding every checkout). The row-count N+1 guard is
 * query-budget.int-spec.ts.
 */
describe('per-request statement budgets (perf audit)', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let user = '';
  let counting = false;
  let statements: string[] = [];
  const original = Reflect.get(Client.prototype, 'query') as Query;

  const server = () => app.getHttpServer() as Server;
  const statementsOf = async (path: string) => {
    statements = [];
    counting = true;
    try {
      await request(server()).get(path).set(bearer(user)).expect(200);
    } finally {
      counting = false;
    }
    return statements;
  };

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, {
      modules: [ProductionEventModule, V2Module],
      rlsBinding: true,
    });
    user = signToken(app, {
      userId: randomUUID(),
      tenantId: world.tenantA,
      role: 'Engineer',
    });
    (Client.prototype as unknown as { query: Query }).query = function (
      this: Client,
      ...args: unknown[]
    ) {
      if (counting) {
        const config = args[0] as string | { text?: string };
        statements.push(
          typeof config === 'string' ? config : (config.text ?? ''),
        );
      }
      return original.apply(this, args);
    };
  });

  afterAll(async () => {
    (Client.prototype as unknown as { query: Query }).query = original;
    await app?.close();
    await harness.stop();
  });

  it.each([
    // identity (1, P01) + the read + RLS binding switches (P02)
    ['/api/v2/notifications/unread-count', 4],
    ['/api/v2/feature-flags', 4],
    // v1 route: one auth guard only (P04)
    ['/api/production-events', 6],
    // every shell read in one request (P08)
    ['/api/v2/session/bootstrap', 14],
  ])('GET %s runs at most %i statements', async (path, budget) => {
    // warm the pool's connections first: a fresh connection binds once more
    await statementsOf(path);
    const counted = await statementsOf(path);
    if (counted.length > budget) {
      throw new Error(
        `${path}: ${counted.length} statements > budget ${budget}:\n${counted.map((s) => `  ${s.replace(/\s+/g, ' ').slice(0, 140)}`).join('\n')}`,
      );
    }
    expect(counted.length).toBeLessThanOrEqual(budget);
  });
});
