import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import {
  RequestContext,
  runWithRequestContext,
} from '../../src/common/context/request-context';
import { ProductionEvent } from '../../src/production-event/production-event.entity';
import { ProductionEventModule } from '../../src/production-event/production-event.module';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

interface EventRow {
  id: string;
  tenantId: string;
}

const EXCLUDED = ['organizations'];

function contextOf(userId: string, tenantId: string): RequestContext {
  return {
    userId,
    tenantId,
    organizationId: null,
    legacyRole: 'Engineer',
    roles: ['Engineer'],
    scopes: [],
    isSuperAdmin: false,
    correlationId: randomUUID(),
  };
}

/**
 * Plan 3.11 step 2 (NFR01, T14 "RLS blocks even a buggy query"): every tenant table carries the
 * `tenant_isolation` policy; under the binding a signed-in caller of tenant B never reads or writes a
 * tenant A row, even through an unscoped repository call or a v1 route that does not filter by tenant.
 */
describe('tenant row-level security (plan 3.11)', () => {
  const harness = new IntegrationHarness();
  let world: EventWorld;
  let bound: INestApplication;
  let unbound: INestApplication;
  let userB = '';
  let userA = '';
  let superAdmin = '';

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    const modules = [ProductionEventModule, V2Module];
    bound = await createIntegrationApp(harness, { modules, rlsBinding: true });
    unbound = await createIntegrationApp(harness, {
      modules,
      rlsBinding: false,
    });
    userA = signToken(bound, {
      userId: randomUUID(),
      tenantId: world.tenantA,
      role: 'TenantAdmin',
    });
    userB = signToken(bound, {
      userId: randomUUID(),
      tenantId: world.tenantB,
      role: 'TenantAdmin',
    });
    superAdmin = signToken(bound, { userId: randomUUID(), role: 'SuperAdmin' });
  });

  afterAll(async () => {
    await bound?.close();
    await unbound?.close();
    await harness.stop();
  });

  it('puts the forced tenant_isolation policy on every table with a tenant_id', async () => {
    const rows: Array<{
      table: string;
      rls: boolean;
      forced: boolean;
      policy: boolean;
    }> = await harness.dataSource.query(
      `SELECT c.relname AS "table", c.relrowsecurity AS rls, c.relforcerowsecurity AS forced,
                EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname
                          AND p.policyname = 'tenant_isolation') AS policy
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
           JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'tenant_id' AND NOT a.attisdropped
          WHERE c.relkind IN ('r', 'p') AND NOT c.relispartition AND c.relname <> ALL ($1)`,
      [EXCLUDED],
    );
    expect(rows.length).toBeGreaterThan(130);
    expect(
      rows.filter((row) => !row.rls || !row.forced || !row.policy),
    ).toEqual([]);
  });

  it('returns 0 foreign rows to a deliberately unscoped repository call', async () => {
    const repository = bound.get(DataSource).getRepository(ProductionEvent);
    const seen = await runWithRequestContext(
      contextOf(randomUUID(), world.tenantB),
      () => repository.find({ select: { id: true, tenantId: true } }),
    );
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((row) => row.tenantId === world.tenantB)).toBe(true);
    // outside a request (worker, CLI) nothing is restricted
    const all = await repository.count();
    expect(all).toBeGreaterThan(seen.length);
  });

  it('keeps isolation when one pooled connection serves tenant A, tenant B and unrestricted calls in turn (perf P02)', async () => {
    const dataSource = bound.get(DataSource);
    const repository = dataSource.getRepository(ProductionEvent);
    const tenantsSeen = async (tenantId: string | null) => {
      // sequential: each statement checks out the (same, idle) connection on its own
      const read = async () => {
        const found = await repository.find({
          select: { id: true, tenantId: true },
        });
        const backend = await dataSource.query<Array<{ pid: number }>>(
          'SELECT pg_backend_pid() AS "pid"',
        );
        return [found, backend] as const;
      };
      const [rows, [{ pid }]] = tenantId
        ? await runWithRequestContext(contextOf(randomUUID(), tenantId), read)
        : await read();
      return { tenants: new Set(rows.map((row) => row.tenantId)), pid };
    };
    const pids = new Set<number>();
    for (let round = 0; round < 3; round += 1) {
      for (const tenantId of [
        world.tenantA,
        world.tenantB,
        null,
        world.tenantA,
      ]) {
        const seen = await tenantsSeen(tenantId);
        pids.add(seen.pid);
        expect(seen.tenants).toEqual(
          tenantId
            ? new Set([tenantId])
            : new Set([world.tenantA, world.tenantB]),
        );
      }
    }
    // sequential checkouts reuse idle connections, so bindings really were switched and skipped on them
    expect(pids.size).toBeLessThan(12);
  });

  it('refuses to write a row for a tenant the caller does not belong to', async () => {
    const repository = bound.get(DataSource).getRepository(ProductionEvent);
    const attempt = runWithRequestContext(
      contextOf(randomUUID(), world.tenantB),
      () =>
        repository.update({ id: world.events.e1 }, { description: 'from B' }),
    );
    await expect(attempt).resolves.toMatchObject({ affected: 0 });
  });

  it('closes the v1 by-id and unfiltered list reads that ignore the tenant', async () => {
    const leaked = await request(unbound.getHttpServer())
      .get(`/api/production-events/${world.events.e1}`)
      .set(bearer(userB))
      .expect(200);
    // control: without the binding the v1 route returns tenant A's event to tenant B
    expect((leaked.body as EventRow).id).toBe(world.events.e1);

    const blocked = await request(bound.getHttpServer())
      .get(`/api/production-events/${world.events.e1}`)
      .set(bearer(userB))
      .expect(200);
    expect(blocked.body).toEqual({});
    const listB = await request(bound.getHttpServer())
      .get('/api/production-events')
      .set(bearer(userB))
      .expect(200);
    const rowsB = (listB.body as { items: EventRow[] }).items;
    expect(rowsB.map((row) => row.tenantId)).toEqual(
      rowsB.map(() => world.tenantB),
    );
    const listAll = await request(bound.getHttpServer())
      .get('/api/production-events')
      .set(bearer(superAdmin))
      .expect(200);
    expect(
      new Set(
        (listAll.body as { items: EventRow[] }).items.map(
          (row) => row.tenantId,
        ),
      ),
    ).toEqual(new Set([world.tenantA, world.tenantB]));
  });

  it('keeps v2 reads and writes working for the tenant itself', async () => {
    const list = await request(bound.getHttpServer())
      .get('/api/v2/production-events')
      .set(bearer(userA))
      .expect(200);
    expect((list.body as { items: unknown[] }).items.length).toBeGreaterThan(0);
    await request(bound.getHttpServer())
      .post('/api/v2/production-events')
      .set(bearer(userA))
      .set('Idempotency-Key', randomUUID())
      .send({
        unitId: world.unitA1,
        eventType: 'ProductionLoss',
        startTime: '2026-10-05T06:00:00.000Z',
        endTime: '2026-10-05T07:00:00.000Z',
      })
      .expect(201);
  });
});
