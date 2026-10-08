import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { CalendarMaterializerService } from '../../../src/calendar/calendar-materializer.service';
import { SitesService } from '../../../src/calendar/sites.service';
import { addDays } from '../../../src/domain/calendar/wall-clock';
import { ProductionEventModule } from '../../../src/production-event/production-event.module';
import { V2Module } from '../../../src/v2/v2.module';
import { IntegrationHarness } from '../harness';
import { EventWorld, seedEventWorld } from './seed-event-world';
import { bearer, createIntegrationApp, signToken } from './test-app';

/** D03 shape (3 × 8 h from 06:00) in a given zone. */
export function threeShiftCalendar(timezone: string): Record<string, unknown> {
  return {
    timezone,
    operationalDayStart: '06:00',
    shiftTemplates: [
      { name: 'A', startLocal: '06:00', endLocal: '14:00' },
      { name: 'B', startLocal: '14:00', endLocal: '22:00' },
      { name: 'C', startLocal: '22:00', endLocal: '06:00' },
    ],
  };
}

export interface ApiError {
  code: string;
  message: string;
}

/**
 * Shared world of the plan 2.1 integration specs: the T13 event world (tenants A and B, units A1–A3, B1)
 * on a fresh schema, the v2 app, and tokens for an A manager (TenantAdmin → manager_approver), an A
 * analyst (no calendar write role) and a B manager. Test data only.
 */
export class CalendarWorld {
  readonly harness = new IntegrationHarness();
  app!: INestApplication;
  world!: EventWorld;
  admin = '';
  analyst = '';
  adminB = '';

  async start(): Promise<void> {
    await this.harness.start();
    this.world = await seedEventWorld(this.harness.dataSource);
    this.app = await createIntegrationApp(this.harness, {
      modules: [ProductionEventModule, V2Module],
    });
    const token = (tenantId: string, role: string) =>
      signToken(this.app, { userId: randomUUID(), tenantId, role });
    this.admin = token(this.world.tenantA, 'TenantAdmin');
    this.analyst = token(this.world.tenantA, 'Analyst');
    this.adminB = token(this.world.tenantB, 'TenantAdmin');
  }

  async stop(): Promise<void> {
    await this.app?.close();
    await this.harness.stop();
  }

  http() {
    return request(this.app.getHttpServer());
  }

  get(path: string, token = this.admin): request.Test {
    return this.http().get(`/api/v2/${path}`).set(bearer(token));
  }

  post(path: string, body: object, token = this.admin): request.Test {
    return this.http()
      .post(`/api/v2/${path}`)
      .set(bearer(token))
      .set('Idempotency-Key', randomUUID())
      .send(body);
  }

  patch(
    path: string,
    body: object,
    etag: string,
    token = this.admin,
  ): request.Test {
    return this.http()
      .patch(`/api/v2/${path}`)
      .set(bearer(token))
      .set('If-Match', etag)
      .send(body);
  }

  /** Operational date "today" of tenant A's default site (UTC fallback in this world). */
  async todayA(offsetDays = 0): Promise<string> {
    const site = await this.app
      .get(SitesService)
      .defaultSite(this.world.tenantA);
    return addDays(
      this.app.get(CalendarMaterializerService).today(site),
      offsetDays,
    );
  }

  /** Creates and publishes a calendar version; returns its id. */
  async publish(
    body: Record<string, unknown>,
    token = this.admin,
  ): Promise<string> {
    const created = await this.post('calendar-versions', body, token).expect(
      201,
    );
    const id = (created.body as { id: string }).id;
    await this.post(`calendar-versions/${id}/publish`, {}, token).expect(200);
    return id;
  }

  rows<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.harness.dataSource.query<T[]>(sql, params);
  }
}
