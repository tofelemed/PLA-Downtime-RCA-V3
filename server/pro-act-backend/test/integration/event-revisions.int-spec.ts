import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { ProductionEventModule } from '../../src/production-event/production-event.module';
import { EventChangeNotifier } from '../../src/production-event/revisions/event-change.notifier';
import { EventRevisionService } from '../../src/production-event/revisions/event-revision.service';
import { CONNECTOR_ACTOR } from '../../src/production-event/revisions/revision-actor';
import { UnitDowntimeService } from '../../src/production-event/unit-downtime.service';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import { at, EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

const DAY = '2026-09-09'; // fixed past date: never today, never the seed world's day
const t = (time: string) => at(time, DAY).toISOString();

interface HistoryBody {
  revisions: Array<Record<string, unknown> & { kind: string }>;
  coding: Array<Record<string, unknown>>;
  reviewItems: Array<{ id: string; field: string; state: string }>;
}

/** Plan 1.2: T04 source refresh, duplicates, override conflicts and review items, retraction, If-Match. */
describe('event revisions and source ownership (plan 1.2)', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let token: string;
  let tokenB: string;
  let revisions: EventRevisionService;
  const userId = randomUUID();

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, {
      modules: [ProductionEventModule, V2Module],
    });
    token = signToken(app, { userId, tenantId: world.tenantA });
    tokenB = signToken(app, { userId: randomUUID(), tenantId: world.tenantB });
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
  const history = async (id: string): Promise<HistoryBody> =>
    (
      await http()
        .get(`/api/v2/production-events/${id}/revisions`)
        .set(bearer(token))
        .expect(200)
    ).body as HistoryBody;
  const patch = (id: string, body: Record<string, unknown>, ifMatch: string) =>
    http()
      .patch(`/api/v2/production-events/${id}`)
      .set(bearer(token))
      .set('If-Match', ifMatch)
      .send(body);
  const resolve = (itemId: string, decision: string, auth = token) =>
    http()
      .post(`/api/v2/event-review-items/${itemId}/resolve`)
      .set(bearer(auth))
      .set('Idempotency-Key', randomUUID())
      .send({ decision });

  /** A PI-sourced event through the v1 API, as the PI bridge creates them. */
  async function createPiEvent(
    facts: Record<string, unknown>,
    unitId = world.unitA1,
  ): Promise<string> {
    const response = await http()
      .post('/api/production-events')
      .set(bearer(token))
      .send({
        eventId: `PI-${randomUUID()}`,
        unitId,
        source: 'PI',
        status: 'Open',
        tenantId: world.tenantA,
        ...facts,
      })
      .expect(201);
    return response.body.id as string;
  }

  describe('T04: a source refresh preserves user work', () => {
    const piFacts = {
      startTime: t('06:00'),
      eventType: 'ProductionLoss',
      description: 'Compressor trip',
    };
    let id: string;
    let rcaId: string;

    beforeAll(async () => {
      id = await createPiEvent(piFacts);
      rcaId = randomUUID();
      await harness.dataSource.query(
        `INSERT INTO rcas (id, title, status, tenant_id) VALUES ($1, 'trip rca', 'Draft', $2)`,
        [rcaId, world.tenantA],
      );
    });

    it('records the creation as source revision 1 with a baseline coding', async () => {
      const body = await history(id);
      expect(body.revisions).toHaveLength(1);
      expect(body.revisions[0]).toMatchObject({
        revision: 1,
        kind: 'source',
        actorKind: 'user',
        actorId: userId,
        sourceFacts: expect.objectContaining({
          startTime: t('06:00'),
          endTime: null,
        }),
      });
      expect(body.coding[0]).toMatchObject({
        revision: 1,
        reason: 'baseline',
        isOverride: false,
      });
      const event = await get(id);
      expect(event.body.sourceFacts).toMatchObject({
        description: 'Compressor trip',
      });
      expect(event.body.overriddenFields).toEqual([]);
    });

    it('user codes a reason (v2 PATCH) and links an RCA (v1 PUT)', async () => {
      const coded = await patch(
        id,
        { reasonCodeId: world.reasonR1 },
        (await get(id)).headers.etag,
      ).expect(200);
      expect(coded.body.states).toMatchObject({ coding: 'coded' });
      const linked = await http()
        .put(`/api/production-events/${id}`)
        .set(bearer(token))
        .send({ rcaId })
        .expect(200);
      expect(linked.body).toMatchObject({
        rcaState: 'linked',
        status: 'Investigating',
      });
      const body = await history(id);
      expect(body.coding[1]).toMatchObject({
        revision: 2,
        isOverride: false,
        newValues: { reasonCodeId: world.reasonR1 },
        authorId: userId,
      });
    });

    it('a new end time from the source updates the interval only', async () => {
      const before = await get(id);
      const outcome = await revisions.applySourceRevision(
        id,
        { ...piFacts, endTime: t('07:00') },
        { actorKind: 'connector', sourceRevision: t('07:00') },
      );
      expect(outcome).toBe('revised');
      const after = await get(id);
      expect(after.body).toMatchObject({
        endTime: t('07:00'),
        durationSeconds: 3600,
        reasonCodeId: world.reasonR1,
        rcaId,
        status: 'Investigating',
        states: { physical: 'closed', coding: 'coded', rca: 'linked' },
        sourceFacts: expect.objectContaining({ endTime: t('07:00') }),
      });
      expect(after.body.rowVersion).toBeGreaterThan(before.body.rowVersion);
      const last = (await history(id)).revisions.at(-1);
      expect(last).toMatchObject({
        kind: 'source',
        actorKind: 'connector',
        sourceRevision: t('07:00'),
        effectiveFacts: expect.objectContaining({
          endTime: t('07:00'),
          status: 'Investigating',
          reasonCodeId: world.reasonR1,
          rcaState: 'linked',
        }),
      });
    });

    it('a duplicate delivery adds no revision and is counted', async () => {
      const before = await get(id);
      const count = (await history(id)).revisions.length;
      const outcome = await revisions.applySourceRevision(
        id,
        { ...piFacts, endTime: t('07:00') },
        { actorKind: 'connector' },
      );
      expect(outcome).toBe('duplicate');
      expect((await history(id)).revisions).toHaveLength(count);
      const [row] = await harness.dataSource.query(
        `SELECT duplicate_deliveries FROM production_events WHERE id = $1`,
        [id],
      );
      expect(row.duplicate_deliveries).toBe(1);
      expect((await get(id)).body.rowVersion).toBe(before.body.rowVersion);
    });
  });

  describe('source vs override conflicts (§5.3)', () => {
    const piFacts = {
      startTime: t('09:00'),
      endTime: t('09:30'),
      eventType: 'ProductionLoss',
      description: 'Pump stop',
      quantity: 10,
    };
    let id: string;
    let itemId: string;

    beforeAll(async () => {
      id = await createPiEvent(piFacts);
    });

    it('a user override survives a source change and opens a review item', async () => {
      const edited = await patch(
        id,
        { description: 'Seal leak (operator)' },
        (await get(id)).headers.etag,
      ).expect(200);
      expect(edited.body.description).toBe('Seal leak (operator)');
      const coding = (await history(id)).coding.at(-1);
      expect(coding).toMatchObject({
        isOverride: true,
        overridesSourceRevision: 1,
        oldValues: { description: 'Pump stop' },
        newValues: { description: 'Seal leak (operator)' },
      });

      const outcome = await revisions.applySourceRevision(
        id,
        { ...piFacts, description: 'Pump stop (PI)' },
        { actorKind: 'connector' },
      );
      expect(outcome).toBe('revised');
      const event = await get(id);
      expect(event.body.description).toBe('Seal leak (operator)');
      expect(event.body.sourceFacts.description).toBe('Pump stop (PI)');
      expect(event.body.overriddenFields).toContain('description');
      const items = (await history(id)).reviewItems;
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ field: 'description', state: 'open' });
      itemId = items[0].id;
    });

    it('a review item of another tenant is 404', async () => {
      expect(
        (await resolve(itemId, 'keep_override', tokenB).expect(404)).body.code,
      ).toBe('NOT_FOUND');
      await http()
        .get(`/api/v2/production-events/${id}/revisions`)
        .set(bearer(tokenB))
        .expect(404);
    });

    it('accept_source writes the source value with provenance', async () => {
      const resolved = await resolve(itemId, 'accept_source').expect(200);
      expect(resolved.body).toMatchObject({
        state: 'accepted_source',
        resolvedBy: userId,
      });
      const event = await get(id);
      expect(event.body.description).toBe('Pump stop (PI)');
      expect(event.body.overriddenFields).not.toContain('description');
      const body = await history(id);
      expect(body.coding.at(-1)).toMatchObject({
        reason: 'accepted source value',
        isOverride: false,
        oldValues: { description: 'Seal leak (operator)' },
        newValues: { description: 'Pump stop (PI)' },
      });
      expect(body.revisions.at(-1)).toMatchObject({
        kind: 'user',
        changeReason: 'accepted source value',
        actorId: userId,
      });
      expect(
        (await resolve(itemId, 'keep_override').expect(409)).body.code,
      ).toBe('REVIEW_ITEM_RESOLVED');
    });

    it('keep_override keeps the user value', async () => {
      await patch(id, { quantity: '25' }, (await get(id)).headers.etag).expect(
        200,
      );
      await revisions.applySourceRevision(
        id,
        { ...piFacts, description: 'Pump stop (PI)', quantity: 12 },
        { actorKind: 'connector' },
      );
      const open = (await history(id)).reviewItems.find(
        (item) => item.field === 'quantity' && item.state === 'open',
      );
      expect(open).toBeDefined();
      await resolve(open!.id, 'keep_override').expect(200);
      const event = await get(id);
      expect(Number(event.body.quantity)).toBe(25);
      expect(Number(event.body.sourceFacts.quantity)).toBe(12);
      expect(event.body.overriddenFields).toContain('quantity');
    });
  });

  it('retraction tombstones the event and drops it from unit downtime', async () => {
    const window = { start: at('00:00', DAY), end: at('23:59', DAY) };
    const downtime = app.get(UnitDowntimeService);
    const id = await createPiEvent(
      {
        startTime: t('10:00'),
        endTime: t('11:00'),
        eventType: 'ProductionLoss',
        description: 'Trip',
      },
      world.unitA3,
    );
    const asOf = { asOf: window.end };
    const before = await downtime.unionForWindow(
      world.tenantA,
      world.unitA3,
      window,
      asOf,
    );
    const retracted = jest.spyOn(
      app.get(EventChangeNotifier),
      'eventRetracted',
    );

    const event = await revisions.retract(
      id,
      CONNECTOR_ACTOR,
      'frame deleted in PI',
    );

    expect(event).toMatchObject({
      physicalState: 'retracted',
      status: 'Cancelled',
    });
    expect(event.retractedAt).toBeInstanceOf(Date);
    expect(retracted).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: id,
        kind: 'retraction',
        affectedFrom: t('10:00'),
        affectedTo: t('11:00'),
      }),
    );
    const after = await downtime.unionForWindow(
      world.tenantA,
      world.unitA3,
      window,
      asOf,
    );
    expect(before.downtimeSeconds - after.downtimeSeconds).toBe(3600);
    expect((await history(id)).revisions.at(-1)).toMatchObject({
      kind: 'retraction',
      changeReason: 'frame deleted in PI',
    });
    expect((await get(id)).body.states.physical).toBe('retracted');
  });

  it('two PATCH with the same If-Match: one wins, the other is 412', async () => {
    const created = await http()
      .post('/api/v2/production-events')
      .set(bearer(token))
      .set('Idempotency-Key', randomUUID())
      .send({
        unitId: world.unitA2,
        eventType: 'ProductionLoss',
        startTime: t('14:00'),
      })
      .expect(201);
    const [first, second] = await Promise.all([
      patch(created.body.id, { description: 'a' }, '"1"'),
      patch(created.body.id, { description: 'b' }, '"1"'),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 412]);
    const stale = first.status === 412 ? first : second;
    expect(stale.body.code).toBe('STALE_REVISION');
    const body = await history(created.body.id);
    expect(body.revisions.map((revision) => revision.kind)).toEqual([
      'user',
      'user',
    ]);
  });
});
