import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as request from 'supertest';
import { ProductionEventModule } from '../../../src/production-event/production-event.module';
import { V2Module } from '../../../src/v2/v2.module';
import { IntegrationHarness } from '../harness';
import { EventWorld, seedEventWorld } from './seed-event-world';
import { bearer, createIntegrationApp, signToken } from './test-app';

export interface RuleBody {
  id: string;
  state: string;
  activeVersion: number | null;
  activeDefinition: unknown;
  draft: { definition: unknown; authorId: string | null } | null;
  rowVersion: number;
}

export interface ErrorBody {
  code: string;
  fieldErrors?: Array<{ field: string; message: string }>;
}

export interface EventBody {
  classification: { scheduleClass: string };
  classificationBasis: Record<
    string,
    { source: string; ruleId: string | null; ruleVersion: number | null }
  > | null;
}

export interface SimulationBody {
  evaluated: number;
  matched: number;
  changed: number;
  version: number | null;
  fields: Record<
    string,
    { before: Record<string, number>; after: Record<string, number> }
  >;
  samples: Array<{
    eventId: string;
    unitId: string;
    changes: Array<{ field: string; before: string | null; after: string }>;
  }>;
}

export type TokenKey =
  | 'author'
  | 'approver'
  | 'analyst'
  | 'adminB'
  | 'unitApprover'
  | 'viewer';

/** The T22 example rule of the contract (`contracts/rules/examples`). */
export const T22 = JSON.parse(
  readFileSync(
    resolve(
      __dirname,
      '../../../../../contracts/rules/examples/t22-long-downtime-unplanned.json',
    ),
    'utf8',
  ),
) as { when: { all: unknown[] }; then: unknown[] };

/** Recent instants relative to now (never a pinned date that could equal today). */
export const hoursAgo = (hours: number) =>
  new Date(Date.now() - hours * 3600_000).toISOString();

interface ScopedUser {
  userId: string;
  kind: 'unit' | 'tenant';
  role: string;
  key: 'unitApprover' | 'viewer';
  legacy: string;
}

/**
 * Plan 3.8 integration world: the T13 event fixture, a draft author and a second approver (TenantAdmin),
 * an analyst, a tenant-B admin, a unit-limited manager approver and a tenant viewer; `restart()` closes
 * the Nest app and boots a new one on the same database (T22 "restart backend").
 */
export class RulesWorld {
  readonly harness = new IntegrationHarness();
  app: INestApplication;
  world: EventWorld;
  readonly ids = { author: randomUUID(), approver: randomUUID() };
  readonly tokens: Record<TokenKey, string> = {
    author: '',
    approver: '',
    analyst: '',
    adminB: '',
    unitApprover: '',
    viewer: '',
  };
  private readonly scoped: ScopedUser[] = [
    {
      userId: randomUUID(),
      kind: 'unit',
      role: 'manager_approver',
      key: 'unitApprover',
      legacy: 'Operator',
    },
    {
      userId: randomUUID(),
      kind: 'tenant',
      role: 'viewer',
      key: 'viewer',
      legacy: 'viewer',
    },
  ];

  async start(): Promise<void> {
    await this.harness.start();
    this.world = await seedEventWorld(this.harness.dataSource);
    for (const user of this.scoped) {
      await this.harness.dataSource.query(
        `INSERT INTO users (id, name, email, password_hash, role, tenant_id) VALUES ($1, 'u', $2, 'x', $3, $4)`,
        [
          user.userId,
          `${user.userId}@test.local`,
          user.legacy,
          this.world.tenantA,
        ],
      );
      const scopeId =
        user.kind === 'unit' ? this.world.unitA1 : this.world.tenantA;
      await this.harness.dataSource.query(
        `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version) VALUES ($1, $2, $3, $4, $5, 1)`,
        [this.world.tenantA, user.userId, user.kind, scopeId, user.role],
      );
    }
    await this.boot();
  }

  async restart(): Promise<void> {
    await this.app.close();
    await this.boot();
  }

  async stop(): Promise<void> {
    await this.app?.close();
    await this.harness.stop();
  }

  private async boot(): Promise<void> {
    this.app = await createIntegrationApp(this.harness, {
      modules: [ProductionEventModule, V2Module],
    });
    const tenantA = this.world.tenantA;
    const sign = (userId: string, role?: string, tenantId = tenantA) =>
      signToken(this.app, { userId, tenantId, role });
    this.tokens.author = sign(this.ids.author, 'TenantAdmin');
    this.tokens.approver = sign(this.ids.approver, 'TenantAdmin');
    this.tokens.analyst = sign(randomUUID());
    this.tokens.adminB = sign(randomUUID(), 'TenantAdmin', this.world.tenantB);
    for (const user of this.scoped)
      this.tokens[user.key] = sign(user.userId, user.legacy);
  }

  http() {
    return request(this.app.getHttpServer());
  }

  post(
    path: string,
    body: object,
    token = this.tokens.author,
    ifMatch?: number,
  ) {
    const call = this.http()
      .post(`/api/v2/${path}`)
      .set(bearer(token))
      .set('Idempotency-Key', randomUUID());
    return (
      ifMatch === undefined ? call : call.set('If-Match', `"${ifMatch}"`)
    ).send(body);
  }

  get(path: string, token = this.tokens.author) {
    return this.http().get(`/api/v2/${path}`).set(bearer(token));
  }

  /** A closed manual downtime in unit A2 (the unit the T22 rule is limited to). */
  createEvent(startHoursAgo: number, hours: number) {
    return this.post('production-events', {
      unitId: this.world.unitA2,
      eventType: 'ProductionLoss',
      startTime: hoursAgo(startHoursAgo),
      endTime: hoursAgo(startHoursAgo - hours),
    }).expect(201);
  }

  t22Definition() {
    return {
      when: {
        all: [
          ...T22.when.all,
          { field: 'unitId', op: 'eq', value: this.world.unitA2 },
        ],
      },
      then: T22.then,
    };
  }
}

/** Typed view of a supertest body. */
export const json = <T>(response: request.Response): T => response.body as T;
