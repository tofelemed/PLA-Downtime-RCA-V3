import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { ProductionEventModule } from '../../src/production-event/production-event.module';
import { UnitDowntimeService } from '../../src/production-event/unit-downtime.service';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import { at, EventWorld, seedEventWorld } from './support/seed-event-world';
import {
  bearer,
  createIntegrationApp,
  signToken,
  TEST_NOW,
} from './support/test-app';

const DAY = '2026-09-08'; // fixed past date: never today, never the seed world's day
const t = (time: string) => at(time, DAY).toISOString();
/** An instant one hour after the test app's clock (DT-09). */
const FUTURE = new Date(TEST_NOW.getTime() + 3_600_000).toISOString();

/** Plan 1.1: T01, T02 (open events), T03, T42, DT08 validation, DT11 adapter, If-Match on PATCH. */
describe('event interval model (plan 1.1)', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let token: string;

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, {
      modules: [ProductionEventModule, V2Module],
    });
    token = signToken(app, { userId: randomUUID(), tenantId: world.tenantA });
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  const http = () => request(app.getHttpServer());
  const create = (body: Record<string, unknown>, key = randomUUID()) =>
    http()
      .post('/api/v2/production-events')
      .set(bearer(token))
      .set('Idempotency-Key', key)
      .send(body);

  describe('POST /api/v2/production-events (DT08)', () => {
    it('T01: 06:00–07:30 has durationSeconds 5400 and the v1 duration is 90 minutes', async () => {
      const response = await create({
        unitId: world.unitA1,
        eventType: 'ProductionLoss',
        startTime: t('06:00'),
        endTime: t('07:30'),
      }).expect(201);
      expect(response.body).toMatchObject({
        durationSeconds: 5400,
        elapsedSeconds: 5400,
        isOpen: false,
        status: 'Open',
        sourceKind: 'manual',
        classification: {
          physicalType: 'downtime',
          oeeComponent: 'availability',
          impactMode: 'full_stop',
        },
        states: { physical: 'closed', coding: 'uncoded', rca: 'none' },
        rowVersion: 1,
      });
      expect(response.headers.etag).toBe('"1"');
      const v1 = await http()
        .get(`/api/production-events/${response.body.id}`)
        .set(bearer(token))
        .expect(200);
      expect(Number(v1.body.duration)).toBe(90);
    });

    it('DT-09: a start or an end in the future is 422 IN_FUTURE, naming the field', async () => {
      const start = await create({
        unitId: world.unitA1,
        eventType: 'ProductionLoss',
        startTime: FUTURE,
      }).expect(422);
      expect(start.body).toMatchObject({
        code: 'IN_FUTURE',
        fieldErrors: [expect.objectContaining({ field: 'startTime' })],
      });
      const end = await create({
        unitId: world.unitA1,
        eventType: 'ProductionLoss',
        startTime: t('09:00'),
        endTime: FUTURE,
      }).expect(422);
      expect(end.body).toMatchObject({
        code: 'IN_FUTURE',
        fieldErrors: [expect.objectContaining({ field: 'endTime' })],
      });
    });

    it('computes the end from durationSeconds', async () => {
      const response = await create({
        unitId: world.unitA1,
        eventType: 'ProductionLoss',
        startTime: t('08:00'),
        durationSeconds: 600,
      }).expect(201);
      expect(response.body.endTime).toBe(t('08:10'));
    });

    it('T02: an open event has no duration but elapsed seconds as of the response', async () => {
      const response = await create({
        unitId: world.unitA2,
        eventType: 'ProductionLoss',
        startTime: t('09:00'),
      }).expect(201);
      expect(response.body.isOpen).toBe(true);
      expect(response.body.durationSeconds).toBeNull();
      const elapsed =
        (new Date(response.body.asOf).getTime() - at('09:00', DAY).getTime()) /
        1000;
      expect(response.body.elapsedSeconds).toBeCloseTo(elapsed, 3);
    });

    it('T42: an IOW is advisory and does not change unit downtime', async () => {
      const window = { start: at('00:00', DAY), end: at('23:59', DAY) };
      const downtime = app.get(UnitDowntimeService);
      const before = await downtime.unionForWindow(
        world.tenantA,
        world.unitA3,
        window,
      );
      const response = await create({
        unitId: world.unitA3,
        eventType: 'IOW',
        startTime: t('10:00'),
        endTime: t('11:00'),
      }).expect(201);
      expect(response.body.classification).toMatchObject({
        physicalType: 'advisory',
        oeeComponent: 'none',
        impactMode: 'none',
      });
      const after = await downtime.unionForWindow(
        world.tenantA,
        world.unitA3,
        window,
      );
      expect(after.downtimeSeconds).toBe(before.downtimeSeconds);
    });

    it.each([
      [{ endTime: t('05:00') }, 'END_BEFORE_START'],
      [{ endTime: t('07:30'), durationSeconds: 60 }, 'DURATION_CONFLICT'],
      [{ endTime: t('06:00') }, 'ZERO_DURATION_DOWNTIME'],
      [{ impactMode: 'fractional' }, 'INVALID_IMPACT'],
    ])('rejects %p with 422 %s', async (patch, code) => {
      const response = await create({
        unitId: world.unitA1,
        eventType: 'ProductionLoss',
        startTime: t('06:00'),
        ...patch,
      }).expect(422);
      expect(response.body.code).toBe(code);
    });

    it('answers 404 for a unit of another tenant', async () => {
      await create({ unitId: world.unitB1, startTime: t('06:00') }).expect(404);
    });

    it('refuses references outside the unit or tenant (422 INVALID_REFERENCE)', async () => {
      const tokenB = signToken(app, {
        userId: randomUUID(),
        tenantId: world.tenantB,
      });
      const foreignAsset = await http()
        .post('/api/v2/production-events')
        .set(bearer(tokenB))
        .set('Idempotency-Key', randomUUID())
        .send({
          unitId: world.unitB1,
          startTime: t('06:00'),
          assetId: world.assetA1,
        })
        .expect(422);
      expect(foreignAsset.body.code).toBe('INVALID_REFERENCE');
      const otherUnit = await create({
        unitId: world.unitA2,
        startTime: t('06:00'),
        assetId: world.assetA1,
      }).expect(422);
      expect(otherUnit.body.fieldErrors[0].field).toBe('assetId');
      const foreignReason = await http()
        .post('/api/v2/production-events')
        .set(bearer(tokenB))
        .set('Idempotency-Key', randomUUID())
        .send({
          unitId: world.unitB1,
          startTime: t('06:00'),
          reasonCodeId: world.reasonR1,
        })
        .expect(422);
      expect(foreignReason.body.fieldErrors[0].field).toBe('reasonCodeId');
    });

    it('replays the same Idempotency-Key without creating a second event', async () => {
      const key = randomUUID();
      const body = {
        unitId: world.unitA1,
        eventType: 'SOL',
        startTime: t('12:00'),
        endTime: t('12:05'),
      };
      const first = await create(body, key).expect(201);
      const second = await create(body, key).expect(201);
      expect(second.body.id).toBe(first.body.id);
    });
  });

  it('T03: unit downtime is the union of overlapping stops', async () => {
    for (const [start, end] of [
      ['10:00', '11:00'],
      ['10:30', '11:30'],
    ]) {
      await create({
        unitId: world.unitA2,
        eventType: 'ProductionLoss',
        startTime: t(start),
        endTime: t(end),
      }).expect(201);
    }
    const result = await app.get(UnitDowntimeService).unionForWindow(
      world.tenantA,
      world.unitA2,
      {
        start: at('10:00', DAY),
        end: at('12:00', DAY),
      },
      { asOf: at('12:00', DAY) },
    );
    // the open 09:00 event from T02 covers the whole window
    expect(result.downtimeSeconds).toBe(7200);
    expect(result.occurrenceCount).toBe(3);
  });

  it('lists by classification and state axes', async () => {
    const response = await http()
      .get('/api/v2/production-events')
      .query({ physicalTypes: 'advisory', from: t('00:00'), to: t('23:59') })
      .set(bearer(token))
      .expect(200);
    expect(response.body.items.length).toBeGreaterThan(0);
    expect(
      response.body.items.every(
        (item: { classification: { physicalType: string } }) =>
          item.classification.physicalType === 'advisory',
      ),
    ).toBe(true);
    await http()
      .get('/api/v2/production-events')
      .query({ physicalTypes: 'bogus' })
      .set(bearer(token))
      .expect(422);
  });

  describe('PATCH with If-Match', () => {
    let id: string;

    beforeAll(async () => {
      const response = await create({
        unitId: world.unitA1,
        eventType: 'ProductionLoss',
        startTime: t('15:00'),
      });
      id = response.body.id;
    });

    const patch = (body: Record<string, unknown>, ifMatch?: string) => {
      const call = http()
        .patch(`/api/v2/production-events/${id}`)
        .set(bearer(token))
        .send(body);
      return ifMatch === undefined ? call : call.set('If-Match', ifMatch);
    };

    it('428 without If-Match, 412 when stale', async () => {
      expect((await patch({ description: 'x' }).expect(428)).body.code).toBe(
        'REVISION_REQUIRED',
      );
      expect(
        (await patch({ description: 'x' }, '"7"').expect(412)).body.code,
      ).toBe('STALE_REVISION');
    });

    it('closes the event, codes it and bumps the revision', async () => {
      const response = await patch(
        { endTime: t('15:30'), reasonCodeId: world.reasonR1 },
        '"1"',
      ).expect(200);
      expect(response.body).toMatchObject({
        durationSeconds: 1800,
        status: 'Coded',
        states: { physical: 'closed', coding: 'coded', rca: 'none' },
        rowVersion: 2,
      });
      expect(response.headers.etag).toBe('"2"');
    });

    it('DT-09: an end moved into the future is 422 IN_FUTURE; other edits are untouched', async () => {
      const response = await patch({ endTime: FUTURE }, '"2"').expect(422);
      expect(response.body.code).toBe('IN_FUTURE');
      await patch({ description: 'still editable' }, '"2"').expect(200);
    });

    it('keeps the interval of source events (409 SOURCE_OWNED)', async () => {
      const sourceEvent = await http()
        .post('/api/production-events')
        .set(bearer(token))
        .send({
          eventId: `PI-${randomUUID()}`,
          unitId: world.unitA1,
          description: 'from PI',
          startTime: t('16:00'),
          source: 'PI',
          status: 'Open',
          eventType: 'ProductionLoss',
          tenantId: world.tenantA,
        })
        .expect(201);
      const response = await http()
        .patch(`/api/v2/production-events/${sourceEvent.body.id}`)
        .set(bearer(token))
        .set('If-Match', '"1"')
        .send({ endTime: t('16:30') })
        .expect(409);
      expect(response.body.code).toBe('SOURCE_OWNED');
    });
  });

  describe('v1 writes go through the adapter (DT11, B8)', () => {
    it('derives duration and translates status on create and update', async () => {
      const created = await http()
        .post('/api/production-events')
        .set(bearer(token))
        .send({
          eventId: `M-${randomUUID()}`,
          unitId: world.unitA1,
          description: 'manual',
          startTime: t('18:00'),
          endTime: t('18:45'),
          source: 'Manual',
          status: 'In Progress',
          eventType: 'ProductionLoss',
          tenantId: world.tenantA,
          duration: 999,
        })
        .expect(201);
      expect(Number(created.body.duration)).toBe(45);
      expect(created.body.status).toBe('Investigating');
      expect(created.body.rcaState).toBe('linked');

      const updated = await http()
        .put(`/api/production-events/${created.body.id}`)
        .set(bearer(token))
        .send({ status: 'Closed' })
        .expect(200);
      expect(updated.body).toMatchObject({
        status: 'Closed',
        codingState: 'reviewed',
      });
    });

    it('rejects an end before the start with 422', async () => {
      const response = await http()
        .post('/api/production-events')
        .set(bearer(token))
        .send({
          eventId: `M-${randomUUID()}`,
          unitId: world.unitA1,
          description: 'bad',
          startTime: t('18:00'),
          endTime: t('17:00'),
          source: 'Manual',
          status: 'Open',
          eventType: 'ProductionLoss',
          tenantId: world.tenantA,
        })
        .expect(422);
      expect(response.body.code).toBe('END_BEFORE_START');
    });
  });

  it('the database refuses an end before the start (DB02)', async () => {
    await expect(
      harness.dataSource.query(
        `INSERT INTO production_events (unit_id, start_time, end_time, tenant_id) VALUES ($1, $2, $3, $4)`,
        [world.unitA1, at('10:00', DAY), at('09:00', DAY), world.tenantA],
      ),
    ).rejects.toThrow(/CHK_production_events_interval/);
  });
});
