import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { RCACauseCodeModule } from '../../src/rca-cause-code/rca-cause-code.module';
import { UnitModule } from '../../src/unit/unit.module';
import { VerificationStatusCodeModule } from '../../src/verification-status-code/verification-status-code.module';
import { IntegrationHarness } from './harness';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

interface ChecklistBody {
  id: string;
  code: string;
  color: string | null;
  items: string[];
}

interface CauseBody {
  id: string;
  code: string;
  parentId: string | null;
}

interface ErrorBody {
  code: string;
}

const ABSENT = '00000000-0000-4000-8000-0000a0d17000';

/**
 * API usage audit fixes: verification checklists store `color` and ordered `items` (create was 400,
 * update 500); RCA cause codes take `parentId` on create and re-parent on update (same tenant, no
 * cycles); v1 get / update / delete of an unknown id answer 404 instead of 200 with an empty body.
 */
describe('RCA settings codes (API usage audit)', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let adminA = '';
  let adminB = '';

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, {
      modules: [VerificationStatusCodeModule, RCACauseCodeModule, UnitModule],
    });
    adminA = signToken(app, {
      userId: randomUUID(),
      tenantId: world.tenantA,
      role: 'TenantAdmin',
    });
    adminB = signToken(app, {
      userId: randomUUID(),
      tenantId: world.tenantB,
      role: 'TenantAdmin',
    });
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  async function createCause(
    token: string,
    tenantId: string,
    code: string,
    parentId?: string,
  ): Promise<CauseBody> {
    const response = await http()
      .post('/api/rca-cause-codes')
      .set(bearer(token))
      .send({ code, name: code, category: 'Equipment', tenantId, parentId })
      .expect(201);
    return response.body as CauseBody;
  }

  describe('verification checklists', () => {
    it('creates and updates a checklist with color and items (round trip)', async () => {
      const created = await http()
        .post('/api/verification-status-codes')
        .set(bearer(adminA))
        .send({
          code: 'VC-1',
          name: 'Restart checks',
          description: 'after a breakdown',
          color: '#3B82F6',
          items: ['Guard closed', 'Lock-out removed'],
          tenantId: world.tenantA,
        })
        .expect(201);
      const body = created.body as ChecklistBody;
      expect(body.color).toBe('#3B82F6');
      expect(body.items).toEqual(['Guard closed', 'Lock-out removed']);

      const updated = await http()
        .put(`/api/verification-status-codes/${body.id}`)
        .set(bearer(adminA))
        .send({
          code: 'VC-1',
          name: 'Restart checks',
          color: '#EF4444',
          items: ['Lock-out removed', 'Guard closed', 'Area clear'],
        })
        .expect(200);
      expect(updated.body as ChecklistBody).toMatchObject({
        id: body.id,
        color: '#EF4444',
        items: ['Lock-out removed', 'Guard closed', 'Area clear'],
      });

      const read = await http()
        .get(`/api/verification-status-codes/${body.id}`)
        .set(bearer(adminA))
        .expect(200);
      expect((read.body as ChecklistBody).items).toEqual([
        'Lock-out removed',
        'Guard closed',
        'Area clear',
      ]);
    });

    it('defaults items to an empty list and validates color and items', async () => {
      const created = await http()
        .post('/api/verification-status-codes')
        .set(bearer(adminA))
        .send({ code: 'VC-2', name: 'Bare', tenantId: world.tenantA })
        .expect(201);
      expect(created.body as ChecklistBody).toMatchObject({
        color: null,
        items: [],
      });
      const id = (created.body as ChecklistBody).id;
      await http()
        .put(`/api/verification-status-codes/${id}`)
        .set(bearer(adminA))
        .send({ color: 'blue' })
        .expect(400);
      await http()
        .put(`/api/verification-status-codes/${id}`)
        .set(bearer(adminA))
        .send({ items: ['ok', 3] })
        .expect(400);
      await http()
        .post('/api/verification-status-codes')
        .set(bearer(adminA))
        .send({ code: 'VC-3', name: 'x', items: 'not a list' })
        .expect(400);
    });

    it('answers 404 for an unknown id on update and delete', async () => {
      await http()
        .put(`/api/verification-status-codes/${ABSENT}`)
        .set(bearer(adminA))
        .send({ color: '#3B82F6', items: ['a'] })
        .expect(404);
      await http()
        .delete(`/api/verification-status-codes/${ABSENT}`)
        .set(bearer(adminA))
        .expect(404);
    });
  });

  describe('RCA cause code tree', () => {
    it('adds a child cause under a parent of the same tenant', async () => {
      const root = await createCause(adminA, world.tenantA, 'C-ROOT');
      expect(root.parentId).toBeNull();
      const child = await createCause(
        adminA,
        world.tenantA,
        'C-CHILD',
        root.id,
      );
      expect(child.parentId).toBe(root.id);
    });

    it('refuses a parent of another tenant or an unknown parent (422 INVALID_REFERENCE)', async () => {
      const foreign = await createCause(adminB, world.tenantB, 'C-FOREIGN');
      for (const [index, parentId] of [foreign.id, ABSENT].entries()) {
        const refused = await http()
          .post('/api/rca-cause-codes')
          .set(bearer(adminA))
          .send({
            code: `C-BAD-${index}`,
            name: 'bad',
            tenantId: world.tenantA,
            parentId,
          })
          .expect(422);
        expect((refused.body as ErrorBody).code).toBe('INVALID_REFERENCE');
      }
      await http()
        .post('/api/rca-cause-codes')
        .set(bearer(adminA))
        .send({ code: 'C-NOT-UUID', name: 'x', parentId: 'abc' })
        .expect(400);
    });

    it('re-parents on update, refuses cycles (422 CODE_CYCLE) and makes a root with null', async () => {
      const a = await createCause(adminA, world.tenantA, 'T-A');
      const b = await createCause(adminA, world.tenantA, 'T-B', a.id);
      const c = await createCause(adminA, world.tenantA, 'T-C', b.id);
      const other = await createCause(adminA, world.tenantA, 'T-OTHER');

      for (const parentId of [c.id, a.id]) {
        const cycle = await http()
          .put(`/api/rca-cause-codes/${a.id}`)
          .set(bearer(adminA))
          .send({ parentId })
          .expect(422);
        expect((cycle.body as ErrorBody).code).toBe('CODE_CYCLE');
      }

      const moved = await http()
        .put(`/api/rca-cause-codes/${b.id}`)
        .set(bearer(adminA))
        .send({ name: 'T-B moved', parentId: other.id })
        .expect(200);
      expect((moved.body as CauseBody).parentId).toBe(other.id);

      const root = await http()
        .put(`/api/rca-cause-codes/${b.id}`)
        .set(bearer(adminA))
        .send({ parentId: null })
        .expect(200);
      expect((root.body as CauseBody).parentId).toBeNull();
    });

    it('deletes the subtree with its root and answers 404 for unknown ids', async () => {
      const root = await createCause(adminA, world.tenantA, 'D-ROOT');
      const child = await createCause(
        adminA,
        world.tenantA,
        'D-CHILD',
        root.id,
      );
      await http()
        .delete(`/api/rca-cause-codes/${root.id}`)
        .set(bearer(adminA))
        .expect(200);
      const rows = await harness.dataSource.query<unknown[]>(
        `SELECT id FROM rca_cause_codes WHERE id = ANY($1)`,
        [[root.id, child.id]],
      );
      expect(rows).toEqual([]);
      await http()
        .put(`/api/rca-cause-codes/${ABSENT}`)
        .set(bearer(adminA))
        .send({ name: 'x' })
        .expect(404);
      await http()
        .delete(`/api/rca-cause-codes/${ABSENT}`)
        .set(bearer(adminA))
        .expect(404);
    });
  });

  describe('v1 unknown ids (units)', () => {
    it('answers 404 on get, update and delete and keeps 200 for an existing unit', async () => {
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
      await http()
        .delete(`/api/units/${ABSENT}`)
        .set(bearer(adminA))
        .expect(404);
      const existing = await http()
        .get(`/api/units/${world.unitA1}`)
        .set(bearer(adminA))
        .expect(200);
      expect((existing.body as { id: string }).id).toBe(world.unitA1);
    });
  });
});
