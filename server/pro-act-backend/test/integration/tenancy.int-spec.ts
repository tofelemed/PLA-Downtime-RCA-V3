import {
  Body,
  Controller,
  INestApplication,
  Module,
  Post,
} from '@nestjs/common';
import { IsString } from 'class-validator';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { ACCESS_DENIED_ACTION } from '../../src/auth/scopes/access-denial-audit.service';
import { Idempotent } from '../../src/common/idempotency/idempotent.decorator';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

class ProbeDto {
  @IsString()
  value!: string;
}

/** Test-only command endpoint that counts executions, to observe idempotent replays. */
@Controller({ path: 'idempotency-probe', version: '2' })
class IdempotencyProbeController {
  executions = 0;

  @Post()
  @Idempotent()
  create(@Body() body: ProbeDto): { execution: number; value: string } {
    this.executions += 1;
    return { execution: this.executions, value: body.value };
  }
}

@Module({ controllers: [IdempotencyProbeController] })
class IdempotencyProbeModule {}

type ScopeRow = {
  kind: 'tenant' | 'unit';
  id: string;
  tenantId: string;
  role: string;
};

async function insertUser(
  dataSource: DataSource,
  user: { tenantId: string; role: string; scopes?: ScopeRow[] },
): Promise<string> {
  const id = randomUUID();
  await dataSource.query(
    `INSERT INTO users (id, name, email, password_hash, role, tenant_id) VALUES ($1, $2, $3, 'x', $4, $5)`,
    [
      id,
      `user ${id.slice(0, 8)}`,
      `${id}@test.local`,
      user.role,
      user.tenantId,
    ],
  );
  for (const scope of user.scopes ?? []) {
    await dataSource.query(
      `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version)
       VALUES ($1, $2, $3, $4, $5, 1)`,
      [scope.tenantId, id, scope.kind, scope.id, scope.role],
    );
  }
  return id;
}

/** T14 tenant attack, user scopes, X-Tenant-Id, scoped SQL, ETag, idempotency and admin-only register. */
describe('tenancy, scopes and API02 concurrency (plan 0.4 part 2)', () => {
  const harness = new IntegrationHarness();
  const sql: string[] = [];
  let app: INestApplication;
  let world: EventWorld;
  let tokenA: string;
  let tokenB: string;
  let previousRegistrationFlag: string | undefined;

  beforeAll(async () => {
    previousRegistrationFlag = process.env.AUTH_ALLOW_PUBLIC_REGISTRATION;
    process.env.AUTH_ALLOW_PUBLIC_REGISTRATION = 'false';
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, {
      modules: [V2Module, IdempotencyProbeModule],
      onQuery: (statement) => sql.push(statement),
    });
    const userA = await insertUser(harness.dataSource, {
      tenantId: world.tenantA,
      role: 'Analyst',
    });
    const userB = await insertUser(harness.dataSource, {
      tenantId: world.tenantB,
      role: 'Analyst',
    });
    tokenA = signToken(app, { userId: userA, tenantId: world.tenantA });
    tokenB = signToken(app, { userId: userB, tenantId: world.tenantB });
  });

  afterAll(async () => {
    process.env.AUTH_ALLOW_PUBLIC_REGISTRATION = previousRegistrationFlag;
    await app?.close();
    await harness.stop();
  });

  const http = () => request(app.getHttpServer());

  async function deniedAuditRows(entityId: string): Promise<number> {
    // the audit write is fire-and-forget; give it a moment to land
    await new Promise((resolve) => setTimeout(resolve, 200));
    const rows: Array<{ count: string }> = await harness.dataSource.query(
      `SELECT count(*)::text AS count FROM audit_logs WHERE action = $1 AND entity_id = $2`,
      [ACCESS_DENIED_ACTION, entityId],
    );
    return Number(rows[0].count);
  }

  describe('T14 tenant attack', () => {
    it('answers 404 for another tenant id in the path (no existence leak)', async () => {
      const foreign = await http()
        .get(`/api/v2/production-events/${world.events.e1}`)
        .set(bearer(tokenB))
        .expect(404);
      const unknown = await http()
        .get(`/api/v2/production-events/${randomUUID()}`)
        .set(bearer(tokenB))
        .expect(404);
      expect(foreign.body.code).toBe(unknown.body.code);
      expect(foreign.body.message).toBe(unknown.body.message);
    });

    it('never returns another tenant rows through filters', async () => {
      const response = await http()
        .get('/api/v2/production-events')
        .query({ unitIds: world.unitA1 })
        .set(bearer(tokenB))
        .expect(200);
      expect(response.body.items).toEqual([]);
    });

    it('rejects tenantId as a query parameter', async () => {
      await http()
        .get('/api/v2/production-events')
        .query({ tenantId: world.tenantA })
        .set(bearer(tokenB))
        .expect(400);
    });

    it('refuses X-Tenant-Id for a tenant the caller is not a member of, and audits it', async () => {
      const response = await http()
        .get('/api/v2/production-events')
        .set(bearer(tokenB))
        .set('X-Tenant-Id', world.tenantA)
        .expect(403);
      expect(response.body.code).toBe('TENANT_NOT_ALLOWED');
      expect(await deniedAuditRows(world.tenantA)).toBeGreaterThan(0);
    });
  });

  describe('X-Tenant-Id selection', () => {
    it('lets a member of two tenants act on the selected one', async () => {
      const member = await insertUser(harness.dataSource, {
        tenantId: world.tenantB,
        role: 'Analyst',
        scopes: [
          {
            kind: 'tenant',
            id: world.tenantB,
            tenantId: world.tenantB,
            role: 'production_engineer',
          },
          {
            kind: 'tenant',
            id: world.tenantA,
            tenantId: world.tenantA,
            role: 'viewer',
          },
        ],
      });
      const token = signToken(app, { userId: member, tenantId: world.tenantB });
      const response = await http()
        .get('/api/v2/production-events')
        .set(bearer(token))
        .set('X-Tenant-Id', world.tenantA)
        .expect(200);
      expect(response.body.scope.tenantId).toBe(world.tenantA);
      expect(response.body.items.length).toBeGreaterThan(0);
    });

    it('lets a SuperAdmin select any existing tenant, but not an unknown one', async () => {
      const admin = await insertUser(harness.dataSource, {
        tenantId: world.tenantB,
        role: 'SuperAdmin',
      });
      const token = signToken(app, {
        userId: admin,
        tenantId: world.tenantB,
        role: 'SuperAdmin',
      });
      await http()
        .get('/api/v2/production-events')
        .set(bearer(token))
        .set('X-Tenant-Id', world.tenantA)
        .expect(200);
      await http()
        .get('/api/v2/production-events')
        .set(bearer(token))
        .set('X-Tenant-Id', randomUUID())
        .expect(403);
    });
  });

  describe('unit-scoped users', () => {
    let token: string;

    beforeAll(async () => {
      const operator = await insertUser(harness.dataSource, {
        tenantId: world.tenantA,
        role: 'Operator',
        scopes: [
          {
            kind: 'unit',
            id: world.unitA1,
            tenantId: world.tenantA,
            role: 'operator',
          },
        ],
      });
      token = signToken(app, {
        userId: operator,
        tenantId: world.tenantA,
        role: 'Operator',
      });
    });

    it('only lists events of the granted unit', async () => {
      const response = await http()
        .get('/api/v2/production-events')
        .set(bearer(token))
        .expect(200);
      const units = new Set(
        response.body.items.map((item: { unitId: string }) => item.unitId),
      );
      expect([...units]).toEqual([world.unitA1]);
    });

    it('answers 404 for an event of another unit in the same tenant', async () => {
      await http()
        .get(`/api/v2/production-events/${world.events.e3}`)
        .set(bearer(token))
        .expect(404);
    });
  });

  it('every v2 query on production_events carries the tenant predicate', async () => {
    sql.length = 0;
    await http()
      .get('/api/v2/production-events')
      .set(bearer(tokenA))
      .expect(200);
    await http()
      .get(`/api/v2/production-events/${world.events.e1}`)
      .set(bearer(tokenA))
      .expect(200);
    const eventQueries = sql.filter((statement) =>
      /FROM "production_events"/i.test(statement),
    );
    expect(eventQueries.length).toBeGreaterThanOrEqual(2);
    for (const statement of eventQueries) {
      expect(statement).toMatch(/"tenant_id" = \$\d+/);
    }
  });

  it('returns ETag = rowVersion on single reads', async () => {
    const response = await http()
      .get(`/api/v2/production-events/${world.events.e1}`)
      .set(bearer(tokenA))
      .expect(200);
    expect(response.body.rowVersion).toBe(1);
    expect(response.headers.etag).toBe('"1"');
  });

  describe('Idempotency-Key (API02)', () => {
    const post = (key: string | null, value: string, token = tokenA) => {
      const call = http()
        .post('/api/v2/idempotency-probe')
        .set(bearer(token))
        .send({ value });
      return key === null ? call : call.set('Idempotency-Key', key);
    };

    it('requires the header (428)', async () => {
      const response = await post(null, 'a').expect(428);
      expect(response.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    });

    it('replays the stored response for the same key and body', async () => {
      const key = randomUUID();
      const first = await post(key, 'a').expect(201);
      const second = await post(key, 'a').expect(201);
      expect(second.body).toEqual(first.body);
      expect(second.headers['idempotent-replayed']).toBe('true');
      const rows: Array<{ count: string }> = await harness.dataSource.query(
        `SELECT count(*)::text AS count FROM idempotency_keys WHERE key = $1`,
        [key],
      );
      expect(rows[0].count).toBe('1');
    });

    it('answers 409 IDEMPOTENCY_MISMATCH for the same key with another body', async () => {
      const key = randomUUID();
      await post(key, 'a').expect(201);
      const response = await post(key, 'b').expect(409);
      expect(response.body.code).toBe('IDEMPOTENCY_MISMATCH');
    });

    it('keeps keys per tenant', async () => {
      const key = randomUUID();
      const a = await post(key, 'a', tokenA).expect(201);
      const b = await post(key, 'b', tokenB).expect(201);
      expect(b.body.value).toBe('b');
      expect(b.body.execution).not.toBe(a.body.execution);
    });
  });

  describe('register is admin-only', () => {
    const payload = {
      name: 'New User',
      email: `${randomUUID()}@test.local`,
      password: 'Sup3r-Secret-Pass!',
      role: 'Operator',
    };

    it('rejects anonymous callers when public registration is off', async () => {
      await http().post('/api/auth/register').send(payload).expect(401);
    });

    it('rejects callers without an admin role', async () => {
      await http()
        .post('/api/auth/register')
        .set(bearer(tokenA))
        .send(payload)
        .expect(403);
    });

    it('does not let a TenantAdmin grant SuperAdmin', async () => {
      const tenantAdmin = await insertUser(harness.dataSource, {
        tenantId: world.tenantA,
        role: 'TenantAdmin',
      });
      const token = signToken(app, {
        userId: tenantAdmin,
        tenantId: world.tenantA,
        role: 'TenantAdmin',
      });
      const response = await http()
        .post('/api/auth/register')
        .set(bearer(token))
        .send({ ...payload, role: 'SuperAdmin' })
        .expect(403);
      expect(response.body.code).toBe('ROLE_GRANT_NOT_ALLOWED');
    });
  });
});
