import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { ProductionEventModule } from '../../../src/production-event/production-event.module';
import { V2Module } from '../../../src/v2/v2.module';
import { IntegrationHarness } from '../harness';
import { EventWorld, seedEventWorld } from './seed-event-world';
import { bearer, createIntegrationApp, signToken } from './test-app';

export interface KnowledgeBody {
  id: string;
  rowVersion: number;
  title: string;
  unitId: string | null;
  unitName: string | null;
  assetName: string | null;
  rcaId: string | null;
  caseTitle: string | null;
  caseStatus: string | null;
  recommendations: string[];
  helpfulCount: number;
  notHelpfulCount: number;
  myVote: string | null;
  isPublished: boolean;
  publishedBy: string | null;
  qualityScore: number;
  quality: Array<{ factor: string; points: number; max: number }>;
  matchedOn?: string[];
  relevance?: number;
}

export interface KnowledgePage {
  items: KnowledgeBody[];
  nextCursor: string | null;
  scope: { tenantId: string; unitIds?: string[] };
}

/**
 * World of the v2 RCA knowledge base spec: the T13 event world (tenants A / B, units A1–A3, asset A1 on
 * unit A1, reasons R1 / R2) on an app with `V2Module`, every SQL statement captured, and tokens for a
 * tenant admin of A (manager approver) and of B, an operator and an analyst of A, and a reliability
 * engineer limited to unit A2. Entries are written straight to the table unless a test closes a case.
 */
export class KnowledgeWorld {
  readonly harness = new IntegrationHarness();
  readonly sql: string[] = [];
  app!: INestApplication;
  world!: EventWorld;
  admin = '';
  adminB = '';
  operator = '';
  analyst = '';
  reliabilityA2 = '';
  adminUserId = randomUUID();

  async start(): Promise<void> {
    await this.harness.start();
    this.world = await seedEventWorld(this.harness.dataSource);
    this.app = await createIntegrationApp(this.harness, {
      modules: [ProductionEventModule, V2Module],
      onQuery: (statement) => this.sql.push(statement),
    });
    const token = (tenantId: string, role: string, userId = randomUUID()) =>
      signToken(this.app, { userId, tenantId, role });
    this.admin = token(this.world.tenantA, 'TenantAdmin', this.adminUserId);
    this.adminB = token(this.world.tenantB, 'TenantAdmin');
    this.operator = token(this.world.tenantA, 'Operator');
    this.analyst = token(this.world.tenantA, 'Analyst');
    this.reliabilityA2 = await this.unitUser(this.world.unitA2);
  }

  async stop(): Promise<void> {
    await this.app?.close();
    await this.harness.stop();
  }

  rows<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.harness.dataSource.query(sql, params);
  }

  get(path: string, token = this.admin): request.Test {
    return request(this.app.getHttpServer())
      .get(`/api/v2/${path}`)
      .set(bearer(token));
  }

  post(
    path: string,
    body: object,
    options: { token?: string; key?: string; ifMatch?: string } = {},
  ): request.Test {
    const test = request(this.app.getHttpServer())
      .post(`/api/v2/${path}`)
      .set(bearer(options.token ?? this.admin))
      .set('Idempotency-Key', options.key ?? randomUUID());
    if (options.ifMatch) test.set('If-Match', options.ifMatch);
    return test.send(body);
  }

  async page(query: string, token = this.admin): Promise<KnowledgePage> {
    const response = await this.get(`rca-knowledge?${query}`, token).expect(
      200,
    );
    return response.body as KnowledgePage;
  }

  /** A knowledge entry of `tenantId` written straight to the table (the v1 / seeded shape). */
  async entry(input: {
    title: string;
    tenantId?: string;
    unitId?: string | null;
    assetId?: string | null;
    rootCause?: string | null;
    published?: boolean;
    createdAt?: string;
  }): Promise<string> {
    const rows = await this.rows<{ id: string }>(
      `INSERT INTO rca_knowledge_base (tenant_id, title, unit_id, asset_id, root_cause, is_published, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, now())) RETURNING id`,
      [
        input.tenantId ?? this.world.tenantA,
        input.title,
        input.unitId ?? null,
        input.assetId ?? null,
        input.rootCause ?? null,
        input.published ?? false,
        input.createdAt ?? null,
      ],
    );
    return rows[0].id;
  }

  /** Opens a case on unit A1, links event e1 (asset A1, reason R1) and closes it: the server writes the entry. */
  async closedCaseEntry(): Promise<{ caseId: string; entryId: string }> {
    const created = await this.post('rcas', {
      title: 'Extruder coupling failures',
      description: 'Extruder trips on vibration',
      unitId: this.world.unitA1,
      rootCause: 'Coupling misalignment',
      recommendations: [
        { title: 'Align the coupling after every seal change' },
      ],
    }).expect(201);
    const caseId = (created.body as { id: string }).id;
    await this.post(`production-events/${this.world.events.e1}/rca-link`, {
      rcaId: caseId,
    }).expect(201);
    const current = await this.get(`rcas/${caseId}`).expect(200);
    await request(this.app.getHttpServer())
      .patch(`/api/v2/rcas/${caseId}`)
      .set(bearer(this.admin))
      .set(
        'If-Match',
        `"${(current.body as { rowVersion: number }).rowVersion}"`,
      )
      .send({ status: 'Closed' })
      .expect(200);
    const rows = await this.rows<{ id: string }>(
      `SELECT id FROM rca_knowledge_base WHERE rca_id = $1`,
      [caseId],
    );
    return { caseId, entryId: rows[0].id };
  }

  /** A token of a user whose only grant is `reliability_engineer` on `unitId`. */
  private async unitUser(unitId: string): Promise<string> {
    const userId = randomUUID();
    await this.rows(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id) VALUES ($1, 'unit user', $2, 'x', 'Operator', $3)`,
      [userId, `${userId}@test.local`, this.world.tenantA],
    );
    await this.rows(
      `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version)
       VALUES ($1, $2, 'unit', $3, 'reliability_engineer', 1)`,
      [this.world.tenantA, userId, unitId],
    );
    return signToken(this.app, {
      userId,
      tenantId: this.world.tenantA,
      role: 'Operator',
    });
  }
}
