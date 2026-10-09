import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { ProductionEventModule } from '../../../src/production-event/production-event.module';
import { V2Module } from '../../../src/v2/v2.module';
import { IntegrationHarness } from '../harness';
import { EventWorld, seedEventWorld } from './seed-event-world';
import { bearer, createIntegrationApp, signToken } from './test-app';

export interface ApiError {
  code: string;
  message: string;
  details?: { conflicts?: Array<{ id: string; version: number }> };
}

export interface ProfileBody {
  id: string;
  unitId: string;
  productId: string;
  version: number;
  state: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  rowVersion: number;
}

export interface RateBody {
  id: string;
  version: number;
  state: string;
  rate: string;
  ratePerSecond: string;
  effectiveFrom: string;
  effectiveTo: string | null;
}

/** Items of a v2 list response. */
export function itemsOf<T>(response: { body: unknown }): T[] {
  return (response.body as { items: T[] }).items;
}

/** Rates of a `GET /profiles/resolve` response by kind. */
export function ratesOf(response: { body: unknown }): Record<string, RateBody> {
  return (response.body as { rates: Record<string, RateBody> }).rates;
}

/**
 * Shared world of the plan 2.2 integration specs: the T13 event world (tenants A and B, units A1–A3,
 * B1) plus products P1, P2 (A) and PB (B) and impact codes IA (A) and IB (B), the v2 app, and tokens for
 * an A manager (TenantAdmin → manager_approver), an A analyst (no write role) and a B manager. Test data
 * only.
 */
export class ProfileWorld {
  readonly harness = new IntegrationHarness();
  app!: INestApplication;
  world!: EventWorld;
  products = { p1: randomUUID(), p2: randomUUID(), pB: randomUUID() };
  impactCodes = { iA: randomUUID(), iB: randomUUID() };
  admin = '';
  analyst = '';
  adminB = '';

  async start(): Promise<void> {
    await this.harness.start();
    this.world = await seedEventWorld(this.harness.dataSource);
    await this.seedProductsAndCodes();
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

  /** Creates (and optionally approves) a profile of unit A1 / product P1 unless overridden. */
  async profile(
    overrides: Record<string, unknown> = {},
    approve = true,
  ): Promise<ProfileBody> {
    const created = await this.post('profiles', {
      unitId: this.world.unitA1,
      productId: this.products.p1,
      quantityUom: 't',
      rateTimebase: 'h',
      effectiveFrom: '2026-10-01T00:00:00Z',
      ...overrides,
    }).expect(201);
    const body = created.body as ProfileBody;
    if (!approve) return body;
    const approved = await this.post(`profiles/${body.id}/approve`, {}).expect(
      200,
    );
    return approved.body as ProfileBody;
  }

  /** Creates a draft rate of a profile, approving it (with supersede) when asked. */
  async rate(
    profileId: string,
    body: Record<string, unknown>,
    approve: { supersede?: boolean } | null = {},
  ): Promise<RateBody> {
    const created = await this.post(`profiles/${profileId}/rates`, {
      rateKind: 'sustained',
      timebase: 'h',
      ...body,
    }).expect(201);
    const rate = created.body as RateBody;
    if (!approve) return rate;
    const approved = await this.post(
      `rates/${rate.id}/approve`,
      approve,
    ).expect(200);
    return approved.body as RateBody;
  }

  rows<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.harness.dataSource.query<T[]>(sql, params);
  }

  private async seedProductsAndCodes(): Promise<void> {
    const { tenantA, tenantB } = this.world;
    const products: Array<[string, string, string]> = [
      [this.products.p1, 'HDPE-A', tenantA],
      [this.products.p2, 'HDPE-B', tenantA],
      [this.products.pB, 'HDPE-A', tenantB],
    ];
    for (const [id, code, tenantId] of products) {
      await this.rows(
        `INSERT INTO products (id, name, code, tenant_id, uom) VALUES ($1, $2, $2, $3, 't')`,
        [id, code, tenantId],
      );
    }
    const codes: Array<[string, string]> = [
      [this.impactCodes.iA, tenantA],
      [this.impactCodes.iB, tenantB],
    ];
    for (const [id, tenantId] of codes) {
      await this.rows(
        `INSERT INTO impact_codes (id, code, name, tenant_id) VALUES ($1, 'IMP-1', 'Impact', $2)`,
        [id, tenantId],
      );
    }
  }
}
