import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import { at, EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

interface ErrorBody {
  code: string;
}

/** Read-only callers (§13.2 `viewer`) can read but never change data (WriteAccessGuard). */
describe('write access for read-only roles', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, { modules: [V2Module] });
  });
  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  async function userWith(
    legacyRole: string,
    scopeRole: string,
  ): Promise<string> {
    const id = randomUUID();
    await harness.dataSource.query(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id)
       VALUES ($1, 'u', $2, 'x', $3, $4)`,
      [id, `${id}@test.local`, legacyRole, world.tenantA],
    );
    await harness.dataSource.query(
      `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version)
       VALUES ($1, $2, 'tenant', $1, $3, 1)`,
      [world.tenantA, id, scopeRole],
    );
    return signToken(app, {
      userId: id,
      tenantId: world.tenantA,
      role: legacyRole,
    });
  }

  const createEvent = (token: string) =>
    request(app.getHttpServer())
      .post('/api/v2/production-events')
      .set(bearer(token))
      .set('Idempotency-Key', randomUUID())
      .send({
        unitId: world.unitA1,
        eventType: 'ProductionLoss',
        startTime: at('06:00', '2026-10-05').toISOString(),
        endTime: at('07:00', '2026-10-05').toISOString(),
      });

  it('lets a viewer read but refuses creates and edits with 403 READ_ONLY_ROLE', async () => {
    const viewer = await userWith('viewer', 'viewer');
    await request(app.getHttpServer())
      .get('/api/v2/production-events')
      .set(bearer(viewer))
      .expect(200);
    const created = await createEvent(viewer).expect(403);
    expect((created.body as ErrorBody).code).toBe('READ_ONLY_ROLE');
    const patched = await request(app.getHttpServer())
      .patch(`/api/v2/production-events/${world.events.e1}`)
      .set(bearer(viewer))
      .set('If-Match', '"1"')
      .send({ description: 'x' })
      .expect(403);
    expect((patched.body as ErrorBody).code).toBe('READ_ONLY_ROLE');
  });

  it('still lets a viewer run a read-only preview', async () => {
    const viewer = await userWith('viewer', 'viewer');
    const response = await request(app.getHttpServer())
      .post('/api/v2/source-mappings/preview')
      .set(bearer(viewer))
      .send({});
    expect(response.status).not.toBe(403);
  });

  it('keeps writes for any role that is not read-only', async () => {
    const operator = await userWith('Operator', 'operator');
    await createEvent(operator).expect(201);
  });
});
