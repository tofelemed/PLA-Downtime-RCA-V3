import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { ProductionEventModule } from '../../src/production-event/production-event.module';
import { EventRevisionService } from '../../src/production-event/revisions/event-revision.service';
import { CONNECTOR_ACTOR } from '../../src/production-event/revisions/revision-actor';
import { UnitDowntimeService } from '../../src/production-event/unit-downtime.service';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import {
  at,
  DAY as SEED_DAY,
  EventWorld,
  seedEventWorld,
} from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';
import {
  ErrorBody,
  json,
  OperationBody,
  Row,
  V2EventClient,
} from './support/v2-event-client';

/**
 * Two days ago (three when that is the seed world's day, whose event e5 is on unit A3): every instant
 * of the day is in the past (close rejects future ends) and no seeded event shares the window.
 */
const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const DAY = daysAgo(2) === SEED_DAY ? daysAgo(3) : daysAgo(2);
const t = (time: string) => at(time, DAY).toISOString();
const DAY_WINDOW = {
  start: at('00:00', DAY),
  end: new Date(at('00:00', DAY).getTime() + 86_400_000),
};

/** Plan 1.4: T37 split/merge lineage, operation errors, tenant isolation, If-Match, idempotency (close: event-close.int-spec.ts). */
describe('event operations: split and merge (plan 1.4)', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let api: V2EventClient;
  let apiB: V2EventClient;
  let downtime: UnitDowntimeService;
  let revisions: EventRevisionService;
  const userId = randomUUID();

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, {
      modules: [ProductionEventModule, V2Module],
    });
    api = new V2EventClient(
      app,
      signToken(app, { userId, tenantId: world.tenantA }),
    );
    apiB = new V2EventClient(
      app,
      signToken(app, { userId: randomUUID(), tenantId: world.tenantB }),
    );
    downtime = app.get(UnitDowntimeService);
    revisions = app.get(EventRevisionService);
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  const unitDowntime = (unitId: string) =>
    downtime.unionForWindow(world.tenantA, unitId, DAY_WINDOW);

  /** Distinct occurrences among the active (open/closed) events of a unit on DAY (KPI06). */
  async function activeOccurrences(unitId: string): Promise<number> {
    const [row]: Array<{ count: string }> = await harness.dataSource.query(
      `SELECT COUNT(DISTINCT occurrence_id) AS count FROM production_events
        WHERE unit_id = $1 AND physical_state IN ('open', 'closed')
          AND start_time >= $2 AND start_time < $3`,
      [unitId, DAY_WINDOW.start, DAY_WINDOW.end],
    );
    return Number(row.count);
  }

  const stop = (start: string, end: string | null, extra: Row = {}) =>
    api.createManual({
      unitId: world.unitA3,
      startTime: t(start),
      ...(end ? { endTime: t(end) } : {}),
      eventType: 'ProductionLoss',
      reasonCodeId: world.reasonR1,
      ...extra,
    });

  describe('T37: split and merge keep downtime, occurrence and lineage', () => {
    let parentId: string;
    let occurrenceId: string;
    let children: string[];
    const splitKey = randomUUID();
    const splitBody = { splitAt: t('11:00'), reason: 'cause changed at 11:00' };

    beforeAll(async () => {
      parentId = await stop('10:00', '12:00', {
        quantity: '120',
        cost: '1000',
      });
      occurrenceId = (await api.event(parentId)).occurrenceId;
    });

    it('starts as one stop of 7200 s and one occurrence', async () => {
      expect(occurrenceId).toBe(parentId);
      expect((await unitDowntime(world.unitA3)).downtimeSeconds).toBe(7200);
      expect(await activeOccurrences(world.unitA3)).toBe(1);
    });

    it('split at 11:00 → two children with the parent coding and occurrence', async () => {
      const response = await api
        .split(parentId, splitBody, await api.etag(parentId), splitKey)
        .expect(201);
      expect(response.body).toMatchObject({
        operation: 'split',
        supersededEventIds: [parentId],
        occurrenceId,
      });
      const body = json<OperationBody>(response);
      children = body.createdEventIds;
      expect(children).toHaveLength(2);
      const [first, second] = body.events;
      expect(first).toMatchObject({
        startTime: t('10:00'),
        endTime: t('11:00'),
        reasonCodeId: world.reasonR1,
        occurrenceId,
        states: { physical: 'closed', coding: 'coded' },
      });
      expect([Number(first.quantity), Number(first.cost)]).toEqual([60, 500]);
      expect(second).toMatchObject({
        startTime: t('11:00'),
        endTime: t('12:00'),
        occurrenceId,
      });
      expect([Number(second.quantity), Number(second.cost)]).toEqual([60, 500]);
      const parent = await api.event(parentId);
      expect(parent).toMatchObject({
        states: { physical: 'superseded' },
        status: 'Cancelled',
        supersededByEventId: null,
      });
    });

    it('replays the split for the same Idempotency-Key with the same children', async () => {
      const replay = await api
        .split(parentId, splitBody, '"1"', splitKey)
        .expect(201);
      expect(replay.headers['idempotent-replayed']).toBe('true');
      expect(json<OperationBody>(replay).createdEventIds).toEqual(children);
    });

    it('downtime stays 7200 s from the children only; occurrence count stays 1', async () => {
      const result = await unitDowntime(world.unitA3);
      expect(result.downtimeSeconds).toBe(7200);
      expect(result.occurrenceCount).toBe(1);
      expect(result.occurrences.map(({ eventId }) => eventId).sort()).toEqual(
        [...children].sort(),
      );
      expect(await activeOccurrences(world.unitA3)).toBe(1);
    });

    it('records system revisions and split_child_of lineage', async () => {
      const parent = await api.history(parentId);
      const last = parent.revisions.at(-1) as Row;
      expect(last).toMatchObject({ kind: 'system', actorId: userId });
      expect(String(last.changeReason)).toContain('cause changed at 11:00');
      expect((last.effectiveFacts as Row).physicalState).toBe('superseded');
      const lineage = parent.relations
        .map((relation) => ({
          relationType: relation.relationType,
          fromEventId: relation.fromEventId,
          toEventId: relation.toEventId,
          occurrenceId: relation.occurrenceId,
        }))
        .sort((a, b) =>
          String(a.fromEventId).localeCompare(String(b.fromEventId)),
        );
      expect(lineage).toEqual(
        [...children].sort().map((child) => ({
          relationType: 'split_child_of',
          fromEventId: child,
          toEventId: parentId,
          occurrenceId,
        })),
      );
      const child = await api.history(children[0]);
      expect(child.revisions).toEqual([
        expect.objectContaining({ revision: 1, kind: 'system' }),
      ]);
      expect(child.coding[0]).toMatchObject({
        revision: 1,
        reasonCodeId: world.reasonR1,
      });
    });

    it('merging the children back → one event with merged_from lineage to both', async () => {
      const events = await Promise.all(
        children.map(async (eventId) => ({
          eventId,
          expectedVersion: (await api.event(eventId)).rowVersion,
        })),
      );
      const response = await api
        .merge({ events, reason: 'one stop after all' })
        .expect(201);
      const [merged] = json<OperationBody>(response).events;
      expect(merged).toMatchObject({
        startTime: t('10:00'),
        endTime: t('12:00'),
        durationSeconds: 7200,
        occurrenceId,
        reasonCodeId: world.reasonR1,
      });
      expect([Number(merged.quantity), Number(merged.cost)]).toEqual([
        120, 1000,
      ]);
      const history = await api.history(merged.id);
      expect(history.relations.map((relation) => relation.toEventId)).toEqual(
        expect.arrayContaining(children),
      );
      expect(history.relations).toHaveLength(2);
      for (const child of children) {
        expect(await api.event(child)).toMatchObject({
          states: { physical: 'superseded' },
          supersededByEventId: merged.id,
        });
      }
      expect((await unitDowntime(world.unitA3)).downtimeSeconds).toBe(7200);
      expect(await activeOccurrences(world.unitA3)).toBe(1);
    });

    it('v1 reads show the superseded parent as Cancelled and refuse edits (409)', async () => {
      const v1 = await request(app.getHttpServer())
        .get(`/api/production-events/${parentId}`)
        .set(bearer(signToken(app, { userId, tenantId: world.tenantA })))
        .expect(200);
      expect(v1.body).toMatchObject({
        status: 'Cancelled',
        physicalState: 'superseded',
      });
      await request(app.getHttpServer())
        .put(`/api/production-events/${parentId}`)
        .set(bearer(signToken(app, { userId, tenantId: world.tenantA })))
        .send({ description: 'edit' })
        .expect(409);
    });
  });

  describe('operation errors', () => {
    it('split outside the interval → 422 SPLIT_OUTSIDE_INTERVAL', async () => {
      const id = await stop('13:00', '14:00');
      const response = await api
        .split(id, { splitAt: t('14:00'), reason: 'x' }, await api.etag(id))
        .expect(422);
      expect(json<ErrorBody>(response).code).toBe('SPLIT_OUTSIDE_INTERVAL');
    });

    it('split of a retracted or superseded event → 409 INVALID_STATE', async () => {
      const id = await stop('14:00', '15:00');
      await revisions.retract(id, CONNECTOR_ACTOR, 'source deleted');
      const retracted = await api
        .split(id, { splitAt: t('14:30'), reason: 'x' }, await api.etag(id))
        .expect(409);
      expect(json<ErrorBody>(retracted).code).toBe('INVALID_STATE');
    });

    it('stale If-Match → 412, missing If-Match → 428', async () => {
      const id = await stop('15:00', '16:00');
      const stale = await api
        .split(id, { splitAt: t('15:30'), reason: 'x' }, '"99"')
        .expect(412);
      expect(json<ErrorBody>(stale).code).toBe('STALE_REVISION');
      await api
        .post(`/api/v2/production-events/${id}/split`, {
          splitAt: t('15:30'),
          reason: 'x',
        })
        .expect(428);
    });

    it('merge of different units → 422; gap above the policy → 422; within it → 201', async () => {
      const a = await stop('16:00', '16:30');
      const otherUnit = await api.createManual({
        unitId: world.unitA2,
        startTime: t('16:30'),
        endTime: t('17:00'),
        eventType: 'ProductionLoss',
      });
      const ref = async (eventId: string) => ({
        eventId,
        expectedVersion: (await api.event(eventId)).rowVersion,
      });
      const units = await api
        .merge({ events: [await ref(a), await ref(otherUnit)], reason: 'x' })
        .expect(422);
      expect(json<ErrorBody>(units).code).toBe('MERGE_DIFFERENT_UNITS');
      const b = await stop('16:40', '17:00');
      const gap = await api
        .merge({ events: [await ref(a), await ref(b)], reason: 'x' })
        .expect(422);
      expect(gap.body).toMatchObject({
        code: 'MERGE_GAP_EXCEEDED',
        details: { gapSeconds: 600, maxGapSeconds: 0 },
      });
      const bridged = await api
        .merge({
          events: [await ref(a), await ref(b)],
          maxGapSeconds: 600,
          reason: 'same stop',
        })
        .expect(201);
      expect(json<OperationBody>(bridged).events[0]).toMatchObject({
        startTime: t('16:00'),
        endTime: t('17:00'),
      });
    });

    it('merge with a stale version → 412 listing the stale event', async () => {
      const a = await stop('18:00', '18:30');
      const b = await stop('18:30', '19:00');
      const response = await api
        .merge({
          events: [
            { eventId: a, expectedVersion: 1 },
            { eventId: b, expectedVersion: 7 },
          ],
          reason: 'x',
        })
        .expect(412);
      expect(json<ErrorBody>(response).details?.stale).toEqual([
        { eventId: b, currentVersion: 1 },
      ]);
    });
  });

  describe('tenant isolation', () => {
    it('another tenant cannot split, close or merge tenant A events (404)', async () => {
      const id = await stop('21:00', '22:00');
      const etag = await api.etag(id);
      await apiB
        .split(id, { splitAt: t('21:30'), reason: 'x' }, etag)
        .expect(404);
      await apiB
        .close(id, { endTime: t('21:30'), reason: 'x' }, etag)
        .expect(404);
      await api
        .merge({
          events: [
            { eventId: id, expectedVersion: 1 },
            { eventId: world.events.eB1, expectedVersion: 1 },
          ],
          reason: 'x',
        })
        .expect(404);
    });
  });
});
