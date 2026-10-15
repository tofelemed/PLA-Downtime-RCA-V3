import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { UnitModule } from '../../src/unit/unit.module';
import { IntegrationHarness } from './harness';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

interface ErrorBody {
  code: string;
}

const ABSENT = '00000000-0000-4000-8000-0000a0d17000';

/**
 * API usage audit fix: v1 get / update / delete of an unknown unit id answer 404 instead of 200 with an
 * empty body. (The v1 verification-status-code and RCA cause-code routes this spec also covered are
 * retired; their v2 successors are `/v2/verification-checklists` and `/v2/rca-causes`.)
 */
describe('v1 unknown ids (API usage audit)', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let adminA = '';

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, { modules: [UnitModule] });
    adminA = signToken(app, {
      userId: randomUUID(),
      tenantId: world.tenantA,
      role: 'TenantAdmin',
    });
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  it('units: answers 404 on get, update and delete and keeps 200 for an existing unit', async () => {
    const notFound = await http()
      .get(`/api/units/${ABSENT}`)
      .set(bearer(adminA))
      .expect(404);
    expect((notFound.body as ErrorBody).code).toBe('NOT_FOUND');
    await http()
      .put(`/api/units/${ABSENT}`)
      .set(bearer(adminA))
      .send({ name: 'x' })
      .expect(404);
    await http().delete(`/api/units/${ABSENT}`).set(bearer(adminA)).expect(404);
    const existing = await http()
      .get(`/api/units/${world.unitA1}`)
      .set(bearer(adminA))
      .expect(200);
    expect((existing.body as { id: string }).id).toBe(world.unitA1);
  });
});
