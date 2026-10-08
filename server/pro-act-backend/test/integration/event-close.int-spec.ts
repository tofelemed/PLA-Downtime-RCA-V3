import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ProductionEventModule } from '../../src/production-event/production-event.module';
import { EventRevisionService } from '../../src/production-event/revisions/event-revision.service';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import { at, EventWorld, seedEventWorld } from './support/seed-event-world';
import { createIntegrationApp, signToken } from './support/test-app';
import {
  ErrorBody,
  json,
  OperationBody,
  Row,
  V2EventClient,
} from './support/v2-event-client';

/** Two days ago: every instant of the day is in the past (close rejects future ends). */
const DAY = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
const t = (time: string) => at(time, DAY).toISOString();

/** Plan 1.4 / DT10: close of manual and source-owned events, source confirmation, late corrections. */
describe('event operations: close (plan 1.4)', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let api: V2EventClient;
  let revisions: EventRevisionService;

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, {
      modules: [ProductionEventModule, V2Module],
    });
    api = new V2EventClient(
      app,
      signToken(app, { userId: randomUUID(), tenantId: world.tenantA }),
    );
    revisions = app.get(EventRevisionService);
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  const stop = (start: string, end: string | null, extra: Row = {}) =>
    api.createManual({
      unitId: world.unitA3,
      startTime: t(start),
      ...(end ? { endTime: t(end) } : {}),
      eventType: 'ProductionLoss',
      reasonCodeId: world.reasonR1,
      ...extra,
    });

  describe('close (DT10)', () => {
    it('closes a manual open event with a user revision', async () => {
      const id = await stop('19:00', null);
      const response = await api
        .close(
          id,
          { endTime: t('19:45'), reason: 'restarted' },
          await api.etag(id),
        )
        .expect(200);
      expect(json<OperationBody>(response).events[0]).toMatchObject({
        endTime: t('19:45'),
        durationSeconds: 2700,
        states: { physical: 'closed' },
      });
      const history = await api.history(id);
      expect(history.revisions.at(-1)).toMatchObject({ kind: 'user' });
      expect(history.coding.at(-1)).toMatchObject({ isOverride: false });
      expect(history.reviewItems).toEqual([]);
      await api
        .close(id, { endTime: t('19:50'), reason: 'again' }, await api.etag(id))
        .expect(409);
    });

    it('rejects an end before the start → 422', async () => {
      const id = await stop('20:00', null);
      const response = await api
        .close(id, { endTime: t('19:00'), reason: 'x' }, await api.etag(id))
        .expect(422);
      expect(json<ErrorBody>(response).code).toBe('CLOSE_END_BEFORE_START');
    });

    it('source-owned: override recorded; the source confirming the end resolves the review item', async () => {
      const facts = {
        startTime: t('05:00'),
        eventType: 'ProductionLoss',
        description: 'Trip',
      };
      const id = await api.createPi(world.tenantA, {
        ...facts,
        unitId: world.unitA1,
      });
      await api
        .close(
          id,
          { endTime: t('05:30'), reason: 'operator' },
          await api.etag(id),
        )
        .expect(200);
      expect((await api.event(id)).overriddenFields).toContain('endTime');
      let history = await api.history(id);
      expect(history.coding.at(-1)).toMatchObject({
        isOverride: true,
        overridesSourceRevision: 1,
      });
      expect(history.reviewItems).toEqual([
        expect.objectContaining({
          kind: 'pending_source_confirmation',
          field: 'endTime',
          state: 'open',
        }),
      ]);
      await revisions.applySourceRevision(
        id,
        { ...facts, endTime: t('05:30') },
        { actorKind: 'connector' },
      );
      history = await api.history(id);
      expect(history.reviewItems).toEqual([
        expect.objectContaining({
          kind: 'pending_source_confirmation',
          state: 'accepted_source',
        }),
      ]);
      const event = await api.event(id);
      expect(event.overriddenFields).not.toContain('endTime');
      expect(event.endTime).toBe(t('05:30'));
    });

    it('source-owned: a different source end keeps the override and opens a conflict', async () => {
      const facts = {
        startTime: t('04:00'),
        eventType: 'ProductionLoss',
        description: 'Trip',
      };
      const id = await api.createPi(world.tenantA, {
        ...facts,
        unitId: world.unitA1,
      });
      await api
        .close(
          id,
          { endTime: t('04:30'), reason: 'operator' },
          await api.etag(id),
        )
        .expect(200);
      await revisions.applySourceRevision(
        id,
        { ...facts, endTime: t('04:45') },
        { actorKind: 'connector' },
      );
      const states = (await api.history(id)).reviewItems.map(
        (item) => `${String(item.kind)}:${String(item.state)}`,
      );
      expect(states.sort()).toEqual([
        'pending_source_confirmation:open',
        'source_vs_override_conflict:open',
      ]);
      expect((await api.event(id)).endTime).toBe(t('04:30'));
    });

    it('a source correction of a split parent stays on it and opens a late_correction item', async () => {
      const facts = {
        startTime: t('02:00'),
        endTime: t('03:00'),
        eventType: 'ProductionLoss',
        description: 'Trip',
      };
      const id = await api.createPi(world.tenantA, {
        ...facts,
        unitId: world.unitA1,
      });
      await api
        .split(id, { splitAt: t('02:30'), reason: 'x' }, await api.etag(id))
        .expect(201);
      await revisions.applySourceRevision(
        id,
        { ...facts, endTime: t('03:10') },
        { actorKind: 'connector' },
      );
      const parent = await api.event(id);
      expect(parent).toMatchObject({
        endTime: t('03:10'),
        states: { physical: 'superseded' },
      });
      expect((await api.history(id)).reviewItems).toEqual([
        expect.objectContaining({ kind: 'late_correction', state: 'open' }),
      ]);
    });
  });
});
