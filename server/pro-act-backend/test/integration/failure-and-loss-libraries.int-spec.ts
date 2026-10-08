import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { ProductionEventModule } from '../../src/production-event/production-event.module';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

interface CodeBody {
  id: string;
  code: string;
  parentId: string | null;
  path: string;
  level: number;
  version: number;
  active: boolean;
}

interface CodeList {
  items: CodeBody[];
}

/** Plan 1.3 (§3.2, §14.2): failure code hierarchy and loss category definitions, per tenant. */
describe('failure groups and loss category definitions (plan 1.3)', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let admin: string;
  let adminB: string;
  let analyst: string;

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, {
      modules: [ProductionEventModule, V2Module],
    });
    admin = signToken(app, {
      userId: randomUUID(),
      tenantId: world.tenantA,
      role: 'TenantAdmin',
    });
    adminB = signToken(app, {
      userId: randomUUID(),
      tenantId: world.tenantB,
      role: 'TenantAdmin',
    });
    analyst = signToken(app, { userId: randomUUID(), tenantId: world.tenantA });
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  const http = () => request(app.getHttpServer());
  /** Typed view of a JSON body (supertest bodies are untyped). */
  const json = <T>(response: request.Response): T => response.body as T;
  const post = (path: string, body: Record<string, unknown>, token = admin) =>
    http()
      .post(`/api/v2/${path}`)
      .set(bearer(token))
      .set('Idempotency-Key', randomUUID())
      .send(body);
  const create = async (
    body: Record<string, unknown>,
    library = 'reason-codes',
  ): Promise<CodeBody> => json<CodeBody>(await post(library, body).expect(201));

  describe('failure groups and loss categories', () => {
    it('enforces class → problem → cause → remedy', async () => {
      const failureClass = await create(
        { code: 'PUMP', name: 'Pumps', groupKind: 'class' },
        'failure-code-groups',
      );
      await post('failure-code-groups', {
        code: 'LEAK',
        name: 'Leak',
        groupKind: 'problem',
        parentId: failureClass.id,
      }).expect(201);
      await post('failure-code-groups', {
        code: 'FIX',
        name: 'Fix',
        groupKind: 'remedy',
        parentId: failureClass.id,
      }).expect(422);
      await post('failure-code-groups', {
        code: 'ORPHAN',
        name: 'x',
        groupKind: 'problem',
      }).expect(422);
      const problems = await http()
        .get('/api/v2/failure-code-groups?groupKind=problem')
        .set(bearer(analyst))
        .expect(200);
      expect(json<CodeList>(problems).items.map((item) => item.code)).toEqual([
        'LEAK',
      ]);
    });

    it('keeps loss category definitions per tenant with a report order', async () => {
      const top = await create(
        { code: 'AVAIL', name: 'Availability losses', reportOrder: 1 },
        'loss-category-defs',
      );
      const sub = await create(
        {
          code: 'AVAIL.BD',
          name: 'Breakdowns',
          parentId: top.id,
          reportOrder: 2,
        },
        'loss-category-defs',
      );
      expect(sub).toMatchObject({ level: 1, reportOrder: 2 });
      const listB = await http()
        .get('/api/v2/loss-category-defs')
        .set(bearer(adminB))
        .expect(200);
      expect(json<CodeList>(listB).items).toEqual([]);
    });
  });
});
