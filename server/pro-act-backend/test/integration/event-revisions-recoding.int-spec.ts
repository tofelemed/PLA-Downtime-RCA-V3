import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { ProductionEventModule } from '../../src/production-event/production-event.module';
import { EventRevisionService } from '../../src/production-event/revisions/event-revision.service';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import { at, EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

const DAY = '2026-09-10'; // fixed past date: never today, never the seed world's day
const t = (time: string) => at(time, DAY).toISOString();

interface ReviewItemBody {
  id: string;
  kind: string;
  field: string | null;
  state: string;
}

/** F2: a source revision never re-codes a coded stop; a different resolved reason is a review item. */
describe('event revisions: the source re-codes a coded stop (F2)', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let token: string;
  let revisions: EventRevisionService;
  const userId = randomUUID();

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, {
      modules: [ProductionEventModule, V2Module],
    });
    token = signToken(app, { userId, tenantId: world.tenantA });
    revisions = app.get(EventRevisionService);
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  const http = () => request(app.getHttpServer());
  const get = (id: string) =>
    http()
      .get(`/api/v2/production-events/${id}`)
      .set(bearer(token))
      .expect(200);
  const history = async (id: string) =>
    (
      await http()
        .get(`/api/v2/production-events/${id}/revisions`)
        .set(bearer(token))
        .expect(200)
    ).body as {
      revisions: Array<{ id: string }>;
      reviewItems: Array<Record<string, unknown> & ReviewItemBody>;
    };
  const resolve = (itemId: string, decision: string) =>
    http()
      .post(`/api/v2/event-review-items/${itemId}/resolve`)
      .set(bearer(token))
      .set('Idempotency-Key', randomUUID())
      .send({ decision });

  /** A PI-sourced event through the v1 API, as the PI bridge creates them. */
  async function createPiEvent(
    facts: Record<string, unknown>,
  ): Promise<string> {
    const response = await http()
      .post('/api/production-events')
      .set(bearer(token))
      .send({
        eventId: `PI-${randomUUID()}`,
        unitId: world.unitA1,
        source: 'PI',
        status: 'Open',
        tenantId: world.tenantA,
        ...facts,
      })
      .expect(201);
    return (response.body as { id: string }).id;
  }

  const piFacts = {
    startTime: t('12:00'),
    endTime: t('12:30'),
    eventType: 'ProductionLoss',
    description: 'Feeder stop',
  };
  const recode = (id: string, reasonToken: string, reasonCodeId: string) =>
    revisions.applySourceRevision(
      id,
      { ...piFacts, reason: reasonToken },
      {
        actorKind: 'connector',
        sourceCoding: { reasonCodeId, reasonToken },
      },
    );
  const itemsOf = async (id: string) =>
    (await history(id)).reviewItems.filter(
      (item) => item.kind === 'source_reason_changed',
    );
  const reasonOf = async (eventId: string) =>
    ((await get(eventId)).body as { reasonCodeId: string | null }).reasonCodeId;
  let id: string;

  beforeAll(async () => {
    id = await createPiEvent({ ...piFacts, reasonCodeId: world.reasonR1 });
  });

  it('a source revision with a different reason opens one source_reason_changed item', async () => {
    expect(await recode(id, 'R2', world.reasonR2)).toBe('revised');
    expect(await reasonOf(id)).toBe(world.reasonR1);
    const body = await history(id);
    const items = await itemsOf(id);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      field: 'reason',
      state: 'open',
      sourceRevisionId: body.revisions.at(-1)?.id,
      codingRevisionId: null,
    });
  });

  it('a second differing revision does not open a second item', async () => {
    expect(await recode(id, 'R2 again', world.reasonR2)).toBe('revised');
    const items = await itemsOf(id);
    expect(items).toHaveLength(1);
    expect(items[0].state).toBe('open');
  });

  it('a later revision with the event code resolves the item', async () => {
    expect(await recode(id, 'R1', world.reasonR1)).toBe('revised');
    const items = await itemsOf(id);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      state: 'accepted_source',
      resolvedBy: null,
    });
    expect(await reasonOf(id)).toBe(world.reasonR1);
  });

  it('dismiss works, accept_source and keep_override are refused', async () => {
    await recode(id, 'R2 once more', world.reasonR2);
    const open = (await itemsOf(id)).find((item) => item.state === 'open');
    expect(open).toBeDefined();
    for (const decision of ['accept_source', 'keep_override']) {
      const refused = await resolve(open!.id, decision).expect(422);
      expect((refused.body as { code: string }).code).toBe('INVALID_DECISION');
    }
    const dismissed = await resolve(open!.id, 'dismiss').expect(200);
    expect(dismissed.body).toMatchObject({
      state: 'dismissed',
      resolvedBy: userId,
    });
    expect(await reasonOf(id)).toBe(world.reasonR1);
  });

  it('an uncoded event or an unresolved token opens nothing', async () => {
    const uncoded = await createPiEvent({
      ...piFacts,
      startTime: t('13:00'),
      endTime: t('13:30'),
    });
    await revisions.applySourceRevision(
      uncoded,
      {
        ...piFacts,
        startTime: t('13:00'),
        endTime: t('13:30'),
        reason: 'R2',
      },
      {
        actorKind: 'connector',
        sourceCoding: { reasonCodeId: world.reasonR2, reasonToken: 'R2' },
      },
    );
    expect(await itemsOf(uncoded)).toHaveLength(0);
    expect(await reasonOf(uncoded)).toBeNull();
    await revisions.applySourceRevision(
      id,
      { ...piFacts, reason: 'NOT-A-CODE' },
      {
        actorKind: 'connector',
        sourceCoding: { reasonCodeId: null, reasonToken: 'NOT-A-CODE' },
      },
    );
    expect(
      (await itemsOf(id)).filter((item) => item.state === 'open'),
    ).toHaveLength(0);
  });
});
