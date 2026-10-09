import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { CalendarMaterializerService } from '../../../src/calendar/calendar-materializer.service';
import { SitesService } from '../../../src/calendar/sites.service';
import { PlanGenerationJobsService } from '../../../src/plans/plan-generation-jobs.service';
import { ProductionEventModule } from '../../../src/production-event/production-event.module';
import { ProductionPlanModule } from '../../../src/production-plan/production-plan.module';
import { V2Module } from '../../../src/v2/v2.module';
import { IntegrationHarness } from '../harness';
import { threeShiftCalendar } from './calendar-world';
import { EventWorld, seedEventWorld } from './seed-event-world';
import { bearer, createIntegrationApp, signToken } from './test-app';

export interface ApiError {
  code: string;
  message: string;
  details?: { conflicts?: Array<{ planId: string; version: number }> };
}

export interface VersionBody {
  id: string;
  planId: string;
  version: number;
  approvalState: string;
  headerTarget: string | null;
  periodsGeneratedAt: string | null;
  rowVersion: number;
  slices: Array<{ id: string; productId: string }>;
}

export interface PlanBody {
  id: string;
  currentVersion: number;
  scenarioId: string;
  version: VersionBody;
}

export interface PeriodBody {
  sliceId: string;
  utcStart: string;
  utcEnd: string;
  shiftName: string;
  localDate: string;
  scheduledSeconds: number;
  target: string;
  sustainedCapacityQty: string | null;
  isExcluded: boolean;
  quantityUom: string | null;
}

export interface PreviewBody {
  headerTarget: string | null;
  totals: Array<{ quantityUom: string | null; target: string }>;
  periods: PeriodBody[];
  warnings: Array<{ code: string }>;
}

/** Fixed test days (Asia/Tehran, UTC+03:30, D03): instances are materialized for them explicitly. */
export const DAY1 = '2027-03-01T02:30:00Z'; // 06:00 local, start of shift A
export const DAY2 = '2027-03-02T02:30:00Z';
export const DAY3 = '2027-03-03T02:30:00Z'; // shift A of this day has a 1 h planned shutdown
export const DAY3_A_END = '2027-03-03T10:30:00Z';

/**
 * World of the plan 2.3 integration specs: the T13 event world (tenants A/B, units A1–A3, B1), products
 * P1 and P2 (tenant A, unit t) and PB (tenant B), a D03 site calendar for tenant A (Asia/Tehran, 3 × 8 h,
 * a 1 h planned shutdown on 3 Mar 2027 06:00 local) materialized for 1–5 Mar 2027, approved profiles of
 * A1/A2 × P1/P2 with planning 90 t/h and sustained 100 t/h, and tokens for an A manager, an A analyst
 * (production engineer) and a B manager. Test data only.
 */
export class PlanWorld {
  readonly harness = new IntegrationHarness();
  app!: INestApplication;
  world!: EventWorld;
  products = { p1: randomUUID(), p2: randomUUID(), pB: randomUUID() };
  /** profile ids by `${unit}:${product}` */
  profiles = new Map<string, string>();
  admin = '';
  analyst = '';
  adminB = '';

  async start(): Promise<void> {
    await this.harness.start();
    this.world = await seedEventWorld(this.harness.dataSource);
    await this.seedProducts();
    this.app = await createIntegrationApp(this.harness, {
      modules: [ProductionEventModule, ProductionPlanModule, V2Module],
    });
    const token = (tenantId: string, role: string) =>
      signToken(this.app, { userId: randomUUID(), tenantId, role });
    this.admin = token(this.world.tenantA, 'TenantAdmin');
    this.analyst = token(this.world.tenantA, 'Analyst');
    this.adminB = token(this.world.tenantB, 'TenantAdmin');
    await this.seedCalendar();
    for (const unit of [this.world.unitA1, this.world.unitA2]) {
      for (const product of [this.products.p1, this.products.p2]) {
        await this.profile(unit, product);
      }
    }
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

  /** A plan body for unit A1 / product P1 over day 1 (quantity 1000) unless overridden. */
  planBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      name: 'HDPE plan',
      unitId: this.world.unitA1,
      validFrom: DAY1,
      validTo: DAY2,
      basis: 'quantity',
      headerTarget: '1000',
      slices: [{ productId: this.products.p1 }],
      ...overrides,
    };
  }

  async createPlan(
    overrides: Record<string, unknown> = {},
    token = this.admin,
  ): Promise<PlanBody> {
    const created = await this.post(
      'production-plans',
      this.planBody(overrides),
      token,
    ).expect(201);
    return created.body as PlanBody;
  }

  /** Requests a generation (202) and runs the worker side. */
  async generate(
    planId: string,
    version: number,
    token = this.admin,
  ): Promise<string> {
    const accepted = await this.post(
      `production-plans/${planId}/generate-periods`,
      { version },
      token,
    ).expect(202);
    await this.runJobs();
    return (accepted.body as { jobId: string }).jobId;
  }

  runJobs(): Promise<number> {
    return this.app.get(PlanGenerationJobsService).runPending();
  }

  async periods(
    planId: string,
    version: number,
    token = this.admin,
  ): Promise<PeriodBody[]> {
    const response = await this.get(
      `production-plans/${planId}/versions/${version}/periods`,
      token,
    ).expect(200);
    return (response.body as { items: PeriodBody[] }).items;
  }

  rows<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.harness.dataSource.query<T[]>(sql, params);
  }

  /** Approved profile with approved planning (90 t/h) and sustained (100 t/h) rates. */
  async profile(
    unitId: string,
    productId: string,
    overrides: Record<string, unknown> = {},
    rates: { planning: string; sustained: string } = {
      planning: '90',
      sustained: '100',
    },
  ): Promise<string> {
    const created = await this.post('profiles', {
      unitId,
      productId,
      quantityUom: 't',
      rateTimebase: 'h',
      effectiveFrom: '2026-01-01T00:00:00Z',
      ...overrides,
    }).expect(201);
    const id = (created.body as { id: string }).id;
    await this.post(`profiles/${id}/approve`, {}).expect(200);
    for (const [rateKind, rate] of Object.entries(rates)) {
      const rateRow = await this.post(`profiles/${id}/rates`, {
        rateKind,
        rate,
        timebase: 'h',
        effectiveFrom: '2026-01-01T00:00:00Z',
      }).expect(201);
      await this.post(
        `rates/${(rateRow.body as { id: string }).id}/approve`,
        {},
      ).expect(200);
    }
    if (!overrides.operatingMode)
      this.profiles.set(`${unitId}:${productId}`, id);
    return id;
  }

  private async seedCalendar(): Promise<void> {
    const created = await this.post('calendar-versions', {
      ...threeShiftCalendar('Asia/Tehran'),
      exclusions: [
        {
          from: '2027-03-03T06:00:00+03:30',
          to: '2027-03-03T07:00:00+03:30',
          reason: 'screw change',
          kind: 'planned_shutdown',
        },
      ],
      effectiveFrom: '2026-01-01',
    }).expect(201);
    await this.post(
      `calendar-versions/${(created.body as { id: string }).id}/publish`,
      {},
    ).expect(200);
    const site = await this.app
      .get(SitesService)
      .defaultSite(this.world.tenantA);
    await this.app.get(CalendarMaterializerService).materialize({
      site,
      unitIds: [this.world.unitA1, this.world.unitA2, this.world.unitA3],
      from: '2027-03-01',
      to: '2027-03-05',
      replaceFrom: null,
      actorId: null,
    });
  }

  private async seedProducts(): Promise<void> {
    const { tenantA, tenantB } = this.world;
    const products: Array<[string, string, string]> = [
      [this.products.p1, 'HDPE-A', tenantA],
      [this.products.p2, 'HDPE-B', tenantA],
      [this.products.pB, 'HDPE-A', tenantB],
    ];
    for (const [id, code, tenantId] of products) {
      await this.rows(
        `INSERT INTO products (id, name, code, tenant_id, uom) VALUES ($1, $2, $3, $4, 't')`,
        [id, code, `${code}-${id.slice(0, 8)}`, tenantId],
      );
    }
  }
}
