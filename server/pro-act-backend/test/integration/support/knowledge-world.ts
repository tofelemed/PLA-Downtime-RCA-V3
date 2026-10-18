import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { addCodedRootCause } from './rca-causes';
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
  /** a second manager approver of tenant A: independent of what `admin` investigates (SME CA1) */
  approver = '';
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
    this.approver = token(this.world.tenantA, 'TenantAdmin');
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

  /** One move of the case workflow (`POST /v2/rcas/{id}/transitions` with the current row version). */
  async transition(
    caseId: string,
    body: object,
    token = this.admin,
  ): Promise<request.Response> {
    const current = await this.get(`rcas/${caseId}`).expect(200);
    return request(this.app.getHttpServer())
      .post(`/api/v2/rcas/${caseId}/transitions`)
      .set(bearer(token))
      .set(
        'If-Match',
        `"${(current.body as { rowVersion: number }).rowVersion}"`,
      )
      .send(body);
  }

  /** A done, evidenced action of the case whose verification window has ended, verified now (CA2 / CA4). */
  async verifiedAction(caseId: string): Promise<void> {
    const now = Date.now();
    const action = await this.post(`rcas/${caseId}/actions`, {
      title: 'Align the coupling',
      actionType: 'repair',
      status: 'done',
      completionEvidenceRef: 'WO-1001 op 10 and alignment report AR-7',
      verificationWindowStart: new Date(
        now - 40 * 24 * 3_600_000,
      ).toISOString(),
      verificationWindowEnd: new Date(now - 24 * 3_600_000).toISOString(),
      baseline: { metric: 'recurrences' },
    }).expect(201);
    const body = action.body as { id: string; rowVersion: number };
    await this.post(
      `rca-actions/${body.id}/verify`,
      {},
      { ifMatch: `"${body.rowVersion}"` },
    ).expect(200);
  }

  /**
   * Opens a case on unit A1, links event e1 (asset A1, reason R1) and closes it through the CA1 workflow
   * (investigation accepted, a verified action, closure requested, approved by an independent manager):
   * the server writes the entry.
   */
  async closedCaseEntry(): Promise<{ caseId: string; entryId: string }> {
    const created = await this.post('rcas', {
      title: 'Extruder coupling failures',
      description: 'Extruder trips on vibration',
      unitId: this.world.unitA1,
      status: 'In Progress',
      consequenceClass: 'minor',
      rootCause: 'Coupling misalignment',
      logicTree: [
        {
          id: 'n1',
          parentId: null,
          label: 'Extruder trips',
          kind: 'event',
          status: 'open',
          notes: null,
        },
        {
          id: 'n2',
          parentId: 'n1',
          label: 'Coupling misalignment',
          kind: 'hypothesis',
          status: 'verified',
          notes: null,
        },
      ],
      recommendations: [
        { title: 'Align the coupling after every seal change' },
      ],
    }).expect(201);
    const caseId = (created.body as { id: string }).id;
    await this.post(`production-events/${this.world.events.e1}/rca-link`, {
      rcaId: caseId,
    }).expect(201);
    await this.verifiedAction(caseId);
    await addCodedRootCause(this, this.world.tenantA, caseId);
    for (const step of [
      { to: 'Analysis' },
      { to: 'Monitoring' },
      { to: 'Closure Review', residualRisk: 'Alignment checked at each PM' },
    ]) {
      expect((await this.transition(caseId, step)).status).toBe(200);
    }
    expect(
      (await this.transition(caseId, { to: 'Closed' }, this.approver)).status,
    ).toBe(200);
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
