import { randomUUID } from 'crypto';
import { EventRevisionService } from '../../src/production-event/revisions/event-revision.service';
import { ActualsWorld } from './support/actuals-world';
import { ErrorBody, json, Row } from './support/v2-event-client';

const DAY_MS = 86_400_000;
/** Midnight UTC `n` days ago: the whole day is in the past. */
const day = (n: number) =>
  new Date(Math.floor((Date.now() - n * DAY_MS) / DAY_MS) * DAY_MS);

interface EventView {
  id: string;
  quantity: string | null;
  reasonCodeId: string | null;
  reasonWeights: Array<{ reasonCodeId: string; weight: string }> | null;
  declaredFigures: Row | null;
  classification: Row;
  states: Row;
}

interface HistoryView {
  reviewItems: Array<{ id: string; kind: string; state: string }>;
}

const FIGURES = {
  planned: 120,
  actual: 112.5,
  shortfall: 7.5,
  sourceStatus: 'CONFIRMED',
};

/**
 * Declared mode: the `production_loss` event kind on real Postgres: manual create with OT figures, the
 * review items of the identity / duplicate / window checks, refused close and split, a reason split by
 * tonnes, and the period recalculation a change asks for. Test data only.
 */
describe('production_loss events (declared mode)', () => {
  const env = new ActualsWorld();
  let unit = '';
  let reasonA = '';
  let reasonB = '';
  /** one window per test (a window is a day of unit A1) */
  let next = 3;

  beforeAll(async () => {
    await env.start();
    unit = env.world.unitA1;
    reasonA = env.world.reasonR1;
    reasonB = env.world.reasonR2;
  });
  afterAll(() => env.stop());

  const window = () => {
    const start = day(next++);
    return { start, end: new Date(start.getTime() + DAY_MS) };
  };

  const addPeriod = async (start: Date, end: Date) => {
    await env.rows(
      `INSERT INTO production_periods (tenant_id, row_version, unit_id, utc_start, utc_end, local_date)
       VALUES ($1, 1, $2, $3::timestamptz, $4::timestamptz, ($3::timestamptz AT TIME ZONE 'UTC')::date)`,
      [env.world.tenantA, unit, start, end],
    );
  };

  const declare = async (
    range: { start: Date; end: Date },
    extra: Row = {},
  ): Promise<string> => {
    const response = await env
      .post('production-events', {
        unitId: unit,
        startTime: range.start.toISOString(),
        endTime: range.end.toISOString(),
        physicalType: 'production_loss',
        declaredFigures: FIGURES,
        ...extra,
      })
      .expect(201);
    return json<EventView>(response).id;
  };

  const view = async (id: string) =>
    json<EventView>(await env.get(`production-events/${id}`).expect(200));

  const items = async (id: string) =>
    json<HistoryView>(
      await env.get(`production-events/${id}/revisions`).expect(200),
    ).reviewItems;

  const kinds = async (id: string) =>
    (await items(id)).map(({ kind, state }) => `${kind}:${state}`);

  it('creates a manual event from declared figures: tonnes, measured, closed', async () => {
    const range = window();
    await addPeriod(range.start, range.end);
    const id = await declare(range);
    expect(await view(id)).toMatchObject({
      quantity: '7.50000000',
      declaredFigures: { ...FIGURES, uom: 't' },
      classification: {
        physicalType: 'production_loss',
        impactMode: 'measured',
        oeeComponent: 'none',
        scheduleClass: 'unknown',
      },
      states: { physical: 'closed' },
    });
    expect(await items(id)).toEqual([]);
  });

  it('refuses a quantity that differs from the shortfall, a missing end and missing figures', async () => {
    const range = window();
    const mismatch = await env
      .post('production-events', {
        unitId: unit,
        startTime: range.start.toISOString(),
        endTime: range.end.toISOString(),
        physicalType: 'production_loss',
        declaredFigures: FIGURES,
        quantity: '9',
      })
      .expect(422);
    expect(json<ErrorBody>(mismatch).code).toBe('VALIDATION_FAILED');
    expect(JSON.stringify(mismatch.body)).toContain('7.5');
    for (const body of [
      { endTime: undefined },
      { declaredFigures: undefined },
    ]) {
      const response = await env
        .post('production-events', {
          unitId: unit,
          startTime: range.start.toISOString(),
          endTime: range.end.toISOString(),
          physicalType: 'production_loss',
          declaredFigures: FIGURES,
          ...body,
        })
        .expect(422);
      expect(json<ErrorBody>(response).code).toBe('VALIDATION_FAILED');
    }
  });

  it('raises an identity mismatch, which a person can dismiss and a corrected source resolves', async () => {
    const range = window();
    await addPeriod(range.start, range.end);
    const broken = { ...FIGURES, actual: 100 };
    const id = await declare(range, { declaredFigures: broken });
    expect(await kinds(id)).toEqual(['declared_identity_mismatch:open']);

    const [item] = await items(id);
    const dismissed = await env
      .post(`event-review-items/${item.id}/resolve`, { decision: 'dismiss' })
      .expect(200);
    expect(json<{ state: string }>(dismissed).state).toBe('dismissed');

    const other = window();
    await addPeriod(other.start, other.end);
    const second = await declare(other, { declaredFigures: broken });
    await env.app.get(EventRevisionService).applySourceRevision(
      second,
      {
        startTime: other.start.toISOString(),
        endTime: other.end.toISOString(),
        declaredFigures: FIGURES,
      },
      { actorKind: 'connector' },
    );
    expect(await kinds(second)).toEqual([
      'declared_identity_mismatch:accepted_source',
    ]);
    expect(await view(second)).toMatchObject({
      quantity: '7.50000000',
      declaredFigures: { actual: 112.5 },
    });
  });

  it('refuses dismiss on the other review kinds', async () => {
    const range = window();
    const stop = await env
      .post('production-events', {
        unitId: unit,
        startTime: range.start.toISOString(),
        endTime: new Date(range.start.getTime() + 3_600_000).toISOString(),
        eventType: 'ProductionLoss',
      })
      .expect(201);
    const [item] = await env.rows<{ id: string }>(
      `INSERT INTO event_review_items (tenant_id, row_version, event_id, kind, state)
       VALUES ($1, 1, $2, 'late_correction', 'open') RETURNING id`,
      [env.world.tenantA, json<EventView>(stop).id],
    );
    const response = await env
      .post(`event-review-items/${item.id}/resolve`, { decision: 'dismiss' })
      .expect(422);
    expect(json<ErrorBody>(response).code).toBe('INVALID_DECISION');
  });

  it('flags a second declaration over the same window as a duplicate', async () => {
    const range = window();
    await addPeriod(range.start, range.end);
    const first = await declare(range);
    const second = await declare(range, { eventId: `dup-${randomUUID()}` });
    expect(await kinds(first)).toEqual([]);
    expect(await kinds(second)).toEqual(['duplicate_declared_loss:open']);
  });

  it('flags a window that is not exactly a period of the unit', async () => {
    const range = window();
    expect(await kinds(await declare(range))).toEqual([
      'declared_window_mismatch:open',
    ]);
  });

  it('cannot be closed or split', async () => {
    const range = window();
    await addPeriod(range.start, range.end);
    const id = await declare(range);
    const etag = String(
      (await env.get(`production-events/${id}`)).headers.etag,
    );
    const close = await env
      .post(
        `production-events/${id}/close`,
        { endTime: range.end.toISOString(), reason: 'x' },
        env.admin,
      )
      .set('If-Match', etag)
      .expect(409);
    expect(json<ErrorBody>(close).code).toBe('UNSUPPORTED_FOR_KIND');
    const split = await env
      .post(
        `production-events/${id}/split`,
        {
          splitAt: new Date(range.start.getTime() + DAY_MS / 2).toISOString(),
          reason: 'x',
        },
        env.admin,
      )
      .set('If-Match', etag)
      .expect(409);
    expect(json<ErrorBody>(split).code).toBe('UNSUPPORTED_FOR_KIND');
  });

  it('splits the reason by tonnes into normalised weights; a wrong total is refused', async () => {
    const range = window();
    await addPeriod(range.start, range.end);
    const id = await declare(range);
    const etag = String(
      (await env.get(`production-events/${id}`)).headers.etag,
    );
    const wrong = await env
      .patch(
        `production-events/${id}`,
        {
          reasonWeights: [
            { reasonCodeId: reasonA, quantity: '4' },
            { reasonCodeId: reasonB, quantity: '3' },
          ],
        },
        etag,
      )
      .expect(422);
    expect(json<ErrorBody>(wrong).code).toBe('REASON_WEIGHTS_SUM');
    await env
      .patch(
        `production-events/${id}`,
        {
          reasonWeights: [
            { reasonCodeId: reasonB, quantity: '1.875' },
            { reasonCodeId: reasonA, quantity: '5.625' },
          ],
        },
        etag,
      )
      .expect(200);
    expect(await view(id)).toMatchObject({
      reasonCodeId: reasonA,
      reasonWeights: [
        { reasonCodeId: reasonA, weight: '0.75000000' },
        { reasonCodeId: reasonB, weight: '0.25000000' },
      ],
    });
  });

  it('asks for a recalculation of the unit and window', async () => {
    const count = async () =>
      (
        await env.rows<{ n: number }>(
          `SELECT count(*)::int AS "n" FROM "outbox"
            WHERE "type" = 'PeriodRecalculateRequested' AND "payload"->>'reason' = 'loss_event_changed'`,
        )
      )[0].n;
    await env.relay();
    const before = await count();
    const range = window();
    await addPeriod(range.start, range.end);
    await declare(range);
    await env.relay();
    expect(await count()).toBeGreaterThan(before);
  });
});
