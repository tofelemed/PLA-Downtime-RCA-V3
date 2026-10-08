import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { bearer } from './test-app';

export type Row = Record<string, unknown>;

/** API error envelope (API03). */
export interface ErrorBody {
  code: string;
  details?: { stale?: Row[]; exclusions?: Row[] } & Row;
}

/** The fields of the v2 event view the operation specs read. */
export interface EventBody extends Row {
  id: string;
  startTime: string;
  endTime: string | null;
  occurrenceId: string;
  rowVersion: number;
  quantity: string | null;
  cost: string | null;
  overriddenFields?: string[];
}

/** Body of split / merge / close. */
export interface OperationBody {
  createdEventIds: string[];
  supersededEventIds: string[];
  occurrenceId: string;
  events: EventBody[];
}

export interface HistoryBody {
  revisions: Row[];
  coding: Row[];
  reviewItems: Row[];
  relations: Row[];
}

/** Typed view of a supertest response body. */
export function json<T>(response: { body: unknown }): T {
  return response.body as T;
}

/** Thin HTTP client for the v2 event resource and its operations (plans 1.2–1.4). */
export class V2EventClient {
  constructor(
    private readonly app: INestApplication,
    private readonly token: string,
  ) {}

  private http() {
    return request(this.app.getHttpServer());
  }

  get(id: string) {
    return this.http()
      .get(`/api/v2/production-events/${id}`)
      .set(bearer(this.token));
  }

  async etag(id: string): Promise<string> {
    const response = await this.get(id).expect(200);
    return String(response.headers.etag);
  }

  /** The event view (200 expected). */
  async event(id: string): Promise<EventBody> {
    return json<EventBody>(await this.get(id).expect(200));
  }

  async history(id: string): Promise<HistoryBody> {
    const response = await this.http()
      .get(`/api/v2/production-events/${id}/revisions`)
      .set(bearer(this.token))
      .expect(200);
    return json<HistoryBody>(response);
  }

  /** Manual event through v2 POST; returns its id. */
  async createManual(body: Record<string, unknown>): Promise<string> {
    const response = await this.post('/api/v2/production-events', body).expect(
      201,
    );
    return json<EventBody>(response).id;
  }

  /** A source (PI) event through v1, as the PI bridge creates them. */
  async createPi(
    tenantId: string,
    body: Record<string, unknown>,
  ): Promise<string> {
    const response = await this.http()
      .post('/api/production-events')
      .set(bearer(this.token))
      .send({
        eventId: `PI-${randomUUID()}`,
        source: 'PI',
        status: 'Open',
        tenantId,
        ...body,
      });
    if (response.status !== 201) {
      throw new Error(`v1 create failed: ${JSON.stringify(response.body)}`);
    }
    return json<{ id: string }>(response).id;
  }

  /** POST with a fresh (or the given) Idempotency-Key and an optional If-Match. */
  post(
    path: string,
    body: Record<string, unknown>,
    options: { key?: string; ifMatch?: string } = {},
  ) {
    const call = this.http()
      .post(path)
      .set(bearer(this.token))
      .set('Idempotency-Key', options.key ?? randomUUID());
    if (options.ifMatch) call.set('If-Match', options.ifMatch);
    return call.send(body);
  }

  split(
    id: string,
    body: Record<string, unknown>,
    ifMatch: string,
    key?: string,
  ) {
    return this.post(`/api/v2/production-events/${id}/split`, body, {
      ifMatch,
      key,
    });
  }

  close(id: string, body: Record<string, unknown>, ifMatch: string) {
    return this.post(`/api/v2/production-events/${id}/close`, body, {
      ifMatch,
    });
  }

  merge(body: Record<string, unknown>) {
    return this.post('/api/v2/production-events/merge', body);
  }

  bulkCode(body: Record<string, unknown>, key?: string) {
    return this.post('/api/v2/production-events/bulk-code', body, { key });
  }

  job(id: string) {
    return this.http().get(`/api/v2/jobs/${id}`).set(bearer(this.token));
  }
}

/**
 * `count` closed downtime events of 30 s on `unitId`, one per minute from `from` (raw insert: the
 * fast way to reach bulk sizes). Returns `{eventId, expectedVersion}` items in insertion order.
 */
export async function insertDowntimeEvents(
  dataSource: DataSource,
  input: { tenantId: string; unitId: string; from: Date; count: number },
): Promise<Array<{ eventId: string; expectedVersion: number }>> {
  const rows: Array<{ id: string; row_version: number }> =
    await dataSource.query(
      `INSERT INTO production_events
         (unit_id, tenant_id, start_time, end_time, source, event_type, physical_type, schedule_class,
          oee_component, impact_mode, physical_state, status)
       SELECT $1, $2, $3::timestamptz + (g * interval '1 minute'),
              $3::timestamptz + (g * interval '1 minute') + interval '30 seconds',
              'Manual', 'ProductionLoss', 'downtime', 'unplanned', 'availability', 'full_stop', 'closed', 'Open'
         FROM generate_series(1, $4::int) AS g
       RETURNING id, row_version`,
      [input.unitId, input.tenantId, input.from.toISOString(), input.count],
    );
  return rows.map((row) => ({
    eventId: row.id,
    expectedVersion: row.row_version,
  }));
}
